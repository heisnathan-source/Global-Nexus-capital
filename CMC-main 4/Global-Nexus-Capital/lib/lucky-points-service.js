import { getDb } from "./db.js";

export async function getActiveEvents(userId) {
  const db = getDb();

  return (
    await db.query(`
      SELECT
        e.id,
        e.name,
        e.description,
        e.start_at,
        e.end_at
      FROM events e
      WHERE e.status = 'active'
        AND (e.start_at IS NULL OR e.start_at <= NOW())
        AND (e.end_at IS NULL OR e.end_at > NOW())
      ORDER BY
        e.start_at NULLS FIRST,
        e.created_at DESC
    `)
  ).rows;
}

export async function getLuckyCardState(userId, eventId) {
  const db = getDb();

  const user = await db.query(
    `
    SELECT
      u.rank_id,
      r.name AS rank_name
    FROM users u
    LEFT JOIN ranks r ON r.id = u.rank_id
    WHERE u.id = $1
    `,
    [userId]
  );

  if (!user.rowCount) {
    throw new Error("User not found.");
  }

  const draws = await db.query(
    `
    SELECT COUNT(*)::int AS draws_used
    FROM lucky_card_draws
    WHERE user_id = $1
      AND event_id = $2
    `,
    [userId, eventId]
  );

  const rules = await db.query(
    `
    SELECT
      lcr.id,
      lcr.prize_name,
      lcr.prize_amount,
      lcr.prize_type,
      lcr.draws_required,
      lcr.max_winners
    FROM lucky_card_rules lcr
    WHERE lcr.event_id = $1
      AND lcr.active = TRUE
      AND (
        lcr.rank_id IS NULL
        OR lcr.rank_id = $2
      )
    ORDER BY lcr.draws_required, lcr.id
    `,
    [eventId, user.rows[0].rank_id]
  );

  return {
    rankName: user.rows[0].rank_name,
    drawsUsed: Number(draws.rows[0]?.draws_used || 0),
    prizes: rules.rows
  };
}

export async function drawLuckyCard(userId, eventId) {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const user = await client.query(
      `
      SELECT
        u.rank_id,
        r.name AS rank_name
      FROM users u
      LEFT JOIN ranks r ON r.id = u.rank_id
      WHERE u.id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (!user.rowCount) {
      throw new Error("User not found.");
    }

    const event = await client.query(
      `
      SELECT *
      FROM events
      WHERE id = $1
        AND status = 'active'
        AND (start_at IS NULL OR start_at <= NOW())
        AND (end_at IS NULL OR end_at > NOW())
      FOR UPDATE
      `,
      [eventId]
    );

    if (!event.rowCount) {
      throw new Error("Event is unavailable.");
    }

    const count = await client.query(
      `
      SELECT COUNT(*)::int AS draws_used
      FROM lucky_card_draws
      WHERE user_id = $1
        AND event_id = $2
      `,
      [userId, eventId]
    );

    const drawNumber =
      Number(count.rows[0]?.draws_used || 0) + 1;

    const rules = await client.query(
      `
      SELECT *
      FROM lucky_card_rules
      WHERE event_id = $1
        AND active = TRUE
        AND (
          rank_id IS NULL
          OR rank_id = $2
        )
        AND draws_required <= $3
        AND (
          max_winners = 0
          OR max_winners >= $3
        )
      ORDER BY draws_required, id
      `,
      [
        eventId,
        user.rows[0].rank_id,
        drawNumber
      ]
    );

    if (!rules.rowCount) {
      throw new Error(
        "You do not currently meet the requirements for a Lucky Card draw."
      );
    }

    const rule =
      rules.rows[
        Math.floor(Math.random() * rules.rowCount)
      ];

    const draw = await client.query(
      `
      INSERT INTO lucky_card_draws
        (
          user_id,
          event_id,
          rule_id,
          draw_number,
          result,
          prize_amount,
          prize_type
        )
      VALUES
        ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        userId,
        eventId,
        rule.id,
        drawNumber,
        rule.prize_name,
        rule.prize_amount,
        rule.prize_type
      ]
    );

    /*
     * Prize fulfillment remains admin-controlled.
     * No cash is automatically credited here.
     */

    await client.query("COMMIT");

    return {
      draw: draw.rows[0],
      prize: rule
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getPointsBalance(userId) {
  const db = getDb();

  const q = await db.query(
    `
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN type = 'award' THEN points
            WHEN type = 'redemption' THEN -points
            ELSE points
          END
        ),
        0
      )::int AS points
    FROM point_ledger
    WHERE user_id = $1
    `,
    [userId]
  );

  return Number(q.rows[0]?.points || 0);
}
