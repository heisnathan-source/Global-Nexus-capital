import { randomUUID } from "crypto";
import { getDb } from "./db.js";


export async function getActiveEvents() {
  const db = getDb();

  const result = await db.query(`
    SELECT
      e.id,
      e.name,
      e.description,
      e.banner_url,
      e.start_at,
      e.end_at
    FROM events e
    WHERE e.status = 'active'
      AND (
        e.start_at IS NULL
        OR e.start_at <= NOW()
      )
      AND (
        e.end_at IS NULL
        OR e.end_at > NOW()
      )
    ORDER BY
      e.start_at NULLS FIRST,
      e.created_at DESC
  `);

  return result.rows;
}


export async function getLuckyCardState(
  userId,
  eventId
) {
  const db = getDb();

  const user = await db.query(
    `
    SELECT
      u.rank_id,
      r.name AS rank_name
    FROM users u
    LEFT JOIN ranks r
      ON r.id = u.rank_id
    WHERE u.id = $1
    `,
    [userId]
  );

  if (!user.rowCount) {
    throw new Error("User not found.");
  }


  const balance = await db.query(
    `
    SELECT
      available_draws
    FROM lucky_card_balances
    WHERE user_id = $1
      AND event_id = $2
    LIMIT 1
    `,
    [userId, eventId]
  );


  const availableDraws =
    Number(
      balance.rows[0]?.available_draws || 0
    );


  const draws = await db.query(
    `
    SELECT COUNT(*)::int AS draws_used
    FROM lucky_card_draws
    WHERE user_id = $1
      AND event_id = $2
    `,
    [userId, eventId]
  );


  const drawsUsed =
    Number(
      draws.rows[0]?.draws_used || 0
    );


  const nextDrawNumber =
    drawsUsed + 1;


  /*
   * Prize rules remain private backend controls.
   *
   * The user only needs an available draw balance.
   * The rule engine secretly determines which
   * configured outcomes are eligible.
   */
  const rules = await db.query(
    `
    SELECT
      lcr.id,
      lcr.prize_name,
      lcr.prize_amount,
      lcr.prize_type,
      lcr.draws_required,
      lcr.draw_number,
      lcr.max_winners,

      COUNT(lcd.id)::int
        AS winners_count

    FROM lucky_card_rules lcr

    LEFT JOIN lucky_card_draws lcd
      ON lcd.rule_id = lcr.id

    WHERE lcr.event_id = $1
      AND lcr.active = TRUE

      AND (
        lcr.rank_id IS NULL
        OR lcr.rank_id = $2
      )

      AND COALESCE(
        lcr.draw_number,
        lcr.draws_required
      ) = $3

    GROUP BY
      lcr.id

    HAVING
      lcr.max_winners = 0
      OR COUNT(lcd.id) < lcr.max_winners

    ORDER BY
      COALESCE(
        lcr.draw_number,
        lcr.draws_required
      ) ASC,
      lcr.id ASC
    `,
    [
      eventId,
      user.rows[0].rank_id,
      nextDrawNumber
    ]
  );


  return {
    rankName:
      user.rows[0]?.rank_name || null,

    availableDraws,

    drawsUsed,

    canDraw: availableDraws > 0
  };
}



/*
 * Fulfill a Lucky Card prize inside the same
 * database transaction as the draw.
 *
 * Points are credited immediately.
 * Cash is credited immediately.
 * Gifts/items remain recorded for manual
 * fulfillment by an administrator.
 */
async function fulfillLuckyCardPrize(
  client,
  {
    userId,
    eventId,
    drawId,
    prizeName,
    prizeAmount,
    prizeType
  }
) {

  const amount =
    Number(prizeAmount || 0);


  /*
   * POINTS PRIZE
   */
  if (prizeType === "points") {

    const points =
      Math.round(amount);

    if (points > 0) {

      await client.query(
        `
        INSERT INTO point_accounts(
          user_id,
          balance,
          updated_at
        )
        VALUES($1, $2, NOW())

        ON CONFLICT(user_id)
        DO UPDATE SET
          balance =
            point_accounts.balance +
            EXCLUDED.balance,
          updated_at = NOW()
        `,
        [
          userId,
          points
        ]
      );


      await client.query(
        `
        INSERT INTO point_ledger
          (
            user_id,
            event_id,
            type,
            points,
            description,
            created_at
          )
        VALUES
          (
            $1,
            $2,
            'award',
            $3,
            $4,
            NOW()
          )
        `,
        [
          userId,
          eventId,
          points,
          `Lucky Card prize: ${prizeName}`
        ]
      );

    }


    return {
      fulfilled: true,
      fulfillmentType: "points",
      amount: points
    };
  }


  /*
   * CASH PRIZE
   */
  if (prizeType === "cash") {

    if (amount > 0) {

      const reference =
        `LCP-${randomUUID()}`;


      const transaction =
        await client.query(
          `
          INSERT INTO transactions
            (
              user_id,
              type,
              amount,
              fee,
              status,
              reference,
              metadata
            )
          VALUES
            (
              $1,
              'lucky_cash_prize',
              $2,
              0,
              'successful',
              $3,
              $4
            )
          RETURNING
            id,
            reference
          `,
          [
            userId,
            amount,
            reference,
            JSON.stringify({
              drawId,
              eventId,
              prizeName
            })
          ]
        );


      /*
       * Ensure the user's wallet exists,
       * then credit the prize.
       */
      await client.query(
        `
        INSERT INTO wallets(
          user_id,
          available_balance,
          reserved_balance,
          updated_at
        )
        VALUES(
          $1,
          0,
          0,
          NOW()
        )

        ON CONFLICT(user_id)
        DO NOTHING
        `,
        [
          userId
        ]
      );


      const wallet =
        await client.query(
          `
          UPDATE wallets
          SET
            available_balance =
              available_balance + $1,
            updated_at = NOW()

          WHERE user_id = $2

          RETURNING
            available_balance
          `,
          [
            amount,
            userId
          ]
        );


      await client.query(
        `
        INSERT INTO wallet_ledger
          (
            user_id,
            transaction_id,
            entry_type,
            amount,
            balance_after,
            description
          )
        VALUES
          (
            $1,
            $2,
            'lucky_cash_prize',
            $3,
            $4,
            $5
          )
        `,
        [
          userId,
          transaction.rows[0].id,
          amount,
          wallet.rows[0].available_balance,
          `Lucky Card cash prize: ${prizeName}`
        ]
      );


      return {
        fulfilled: true,
        fulfillmentType: "cash",
        amount
      };
    }


    return {
      fulfilled: true,
      fulfillmentType: "cash",
      amount: 0
    };
  }


  /*
   * GIFT / ITEM PRIZE
   *
   * The draw itself is already permanently
   * recorded. Physical gifts are fulfilled
   * manually by the administrator.
   */
  return {
    fulfilled: false,
    fulfillmentType: "gift",
    amount: 0
  };
}


export async function drawLuckyCard(
  userId,
  eventId
) {
  const db = getDb();

  const client =
    await db.connect();

  try {

    await client.query("BEGIN");


    const user = await client.query(
      `
      SELECT
        u.rank_id,
        r.name AS rank_name
      FROM users u

      LEFT JOIN ranks r
        ON r.id = u.rank_id

      WHERE u.id = $1

      FOR UPDATE OF u
      `,
      [userId]
    );


    if (!user.rowCount) {
      throw new Error("User not found.");
    }


    const event = await client.query(
      `
      SELECT id
      FROM events

      WHERE id = $1
        AND status = 'active'

        AND (
          start_at IS NULL
          OR start_at <= NOW()
        )

        AND (
          end_at IS NULL
          OR end_at > NOW()
        )

      FOR UPDATE
      `,
      [eventId]
    );


    if (!event.rowCount) {
      throw new Error(
        "Event is unavailable."
      );
    }


    /*
     * Lock the user's event-specific
     * Lucky Card balance.
     */
    const balance = await client.query(
      `
      SELECT
        id,
        available_draws
      FROM lucky_card_balances
      WHERE user_id = $1
        AND event_id = $2
      FOR UPDATE
      `,
      [userId, eventId]
    );


    const availableDraws =
      Number(
        balance.rows[0]?.available_draws || 0
      );


    if (
      !balance.rowCount ||
      availableDraws < 1
    ) {
      throw new Error(
        "You do not currently have an available Lucky Card draw."
      );
    }


    const count = await client.query(
      `
      SELECT COUNT(*)::int
        AS draws_used

      FROM lucky_card_draws

      WHERE user_id = $1
        AND event_id = $2
      `,
      [userId, eventId]
    );


    const drawNumber =
      Number(
        count.rows[0]?.draws_used || 0
      ) + 1;


    /*
     * Find and lock candidate admin-controlled rules.
     *
     * Locking the actual rule rows ensures that another
     * Lucky Card draw cannot simultaneously consume the
     * final winner slot of the same limited rule.
     */
    const candidateRules = await client.query(
      `
      SELECT
        lcr.*

      FROM lucky_card_rules lcr

      WHERE lcr.event_id = $1
        AND lcr.active = TRUE

        AND (
          lcr.rank_id IS NULL
          OR lcr.rank_id = $2
        )

        AND COALESCE(
          lcr.draw_number,
          lcr.draws_required
        ) = $3

      ORDER BY
        CASE
          WHEN lcr.rank_id IS NULL THEN 1
          ELSE 0
        END,
        lcr.id ASC

      FOR UPDATE
      `,
      [
        eventId,
        user.rows[0].rank_id,
        drawNumber
      ]
    );


    if (!candidateRules.rowCount) {
      throw new Error(
        "No Lucky Card prize is currently configured for this draw."
      );
    }


    /*
     * Re-check winner limits after the rule rows
     * have been locked.
     *
     * max_winners = 0 means unlimited.
     */
    const eligibleRules = [];

    for (const candidate of candidateRules.rows) {

      const winnerCount = await client.query(
        `
        SELECT COUNT(*)::int AS winners_count
        FROM lucky_card_draws
        WHERE rule_id = $1
        `,
        [
          candidate.id
        ]
      );

      const winnersCount =
        Number(
          winnerCount.rows[0]?.winners_count || 0
        );

      if (
        Number(candidate.max_winners) === 0 ||
        winnersCount < Number(candidate.max_winners)
      ) {
        eligibleRules.push({
          ...candidate,
          winners_count: winnersCount
        });
      }

    }


    if (!eligibleRules.length) {
      throw new Error(
        "No Lucky Card prize is currently available for this draw."
      );
    }


    /*
     * Admin-controlled outcome.
     *
     * Rank-specific rules take priority over
     * rules configured for all ranks.
     */
    const rankSpecificRule =
      eligibleRules.find(
        (rule) =>
          rule.rank_id &&
          String(rule.rank_id) ===
            String(user.rows[0].rank_id || "")
      );

    const rule =
      rankSpecificRule || eligibleRules[0];


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
     * Consume exactly one available draw.
     */
    const updatedBalance =
      await client.query(
        `
        UPDATE lucky_card_balances
        SET
          available_draws =
            available_draws - 1,
          updated_at = NOW()
        WHERE id = $1
          AND available_draws > 0
        RETURNING available_draws
        `,
        [
          balance.rows[0].id
        ]
      );


    if (!updatedBalance.rowCount) {
      throw new Error(
        "Lucky Card balance could not be updated."
      );
    }


    /*
     * Fulfill the Lucky Card prize before
     * committing the database transaction.
     */
    const fulfillment =
      await fulfillLuckyCardPrize(
        client,
        {
          userId,
          eventId,
          drawId: draw.rows[0].id,
          prizeName: rule.prize_name,
          prizeAmount: rule.prize_amount,
          prizeType: rule.prize_type
        }
      );


    await client.query("COMMIT");


    return {
      draw:
        draw.rows[0],

      prize:
        rule,

      boxPosition:
        Number(rule.box_position || 1),

      fulfillment,

      availableDraws:
        Number(
          updatedBalance.rows[0]
            ?.available_draws || 0
        )
    };

  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    throw error;

  } finally {

    client.release();

  }
}


export async function getPointsBalance(
  userId
) {
  const db = getDb();

  const result = await db.query(
    `
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN type = 'award'
              THEN points

            WHEN type = 'redemption'
              THEN -points

            ELSE points
          END
        ),
        0
      )::int
      AS points

    FROM point_ledger

    WHERE user_id = $1
    `,
    [userId]
  );


  return Number(
    result.rows[0]?.points || 0
  );
}
