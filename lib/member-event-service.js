import { getDb } from "@/lib/db.js";


/*
 * Count direct referrals that became qualified
 * on or after a particular event started.
 */
async function getQualifyingMemberCount(
  client,
  userId,
  eventStartAt
) {
  if (!eventStartAt) {
    return 0;
  }

  const result = await client.query(
    `
    SELECT COUNT(*)::int AS count
    FROM direct_referrals dr
    WHERE dr.sponsor_user_id = $1
      AND (
        LOWER(
          COALESCE(
            dr.qualifying_status,
            ''
          )
        ) IN (
          'qualified',
          'rank_qualified',
          'starter_qualified',
          'active',
          'full_time',
          'full_member'
        )
        OR dr.qualified_at IS NOT NULL
      )
      AND dr.qualified_at IS NOT NULL
      AND dr.qualified_at >= $2
    `,
    [
      userId,
      eventStartAt
    ]
  );

  return Number(
    result.rows[0]?.count || 0
  );
}


/*
 * Credit event points.
 */
async function creditPoints(
  client,
  {
    userId,
    eventId,
    amount,
    description
  }
) {
  const points =
    Math.round(Number(amount));

  if (
    !Number.isFinite(points) ||
    points <= 0
  ) {
    throw new Error(
      "Event points reward must be greater than zero."
    );
  }

  await client.query(
    `
    INSERT INTO point_accounts
      (
        user_id,
        balance,
        updated_at
      )
    VALUES
      (
        $1,
        $2,
        NOW()
      )

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
      description
    ]
  );
}


/*
 * Credit event cash reward.
 */
async function creditCash(
  client,
  {
    userId,
    eventId,
    prizeId,
    amount,
    description
  }
) {
  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      "Event cash reward must be greater than zero."
    );
  }

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
          'event_reward',
          $2,
          0,
          'completed',
          $3,
          $4::jsonb
        )
      RETURNING id
      `,
      [
        userId,
        numericAmount,
        `EVENT-${eventId}-${prizeId}`,
        JSON.stringify({
          eventId,
          prizeId,
          source: "member_event_reward"
        })
      ]
    );

  const transactionId =
    transaction.rows[0].id;

  let wallet =
    await client.query(
      `
      UPDATE wallets
      SET
        available_balance =
          available_balance + $2,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING available_balance
      `,
      [
        userId,
        numericAmount
      ]
    );

  if (!wallet.rowCount) {

    wallet =
      await client.query(
        `
        INSERT INTO wallets
          (
            user_id,
            available_balance,
            reserved_balance,
            updated_at
          )
        VALUES
          (
            $1,
            $2,
            0,
            NOW()
          )
        RETURNING available_balance
        `,
        [
          userId,
          numericAmount
        ]
      );
  }

  await client.query(
    `
    INSERT INTO wallet_ledger
      (
        user_id,
        transaction_id,
        entry_type,
        amount,
        balance_after,
        description,
        created_at
      )
    VALUES
      (
        $1,
        $2,
        'credit',
        $3,
        $4,
        $5,
        NOW()
      )
    `,
    [
      userId,
      transactionId,
      numericAmount,
      wallet.rows[0].available_balance,
      description
    ]
  );
}


/*
 * Process every reward currently unlocked
 * by a particular member.
 */
export async function processMemberEventRewards(
  userId
) {
  const db = getDb();

  const client =
    await db.connect();

  try {

    await client.query("BEGIN");

    const eventsResult =
      await client.query(
        `
        SELECT
          id,
          name,
          start_at
        FROM events
        WHERE status = 'active'
          AND start_at IS NOT NULL
          AND start_at <= NOW()
          AND (
            end_at IS NULL
            OR end_at >= NOW()
          )
        ORDER BY start_at ASC
        `
      );

    const results = [];

    for (const event of eventsResult.rows) {

      const memberCount =
        await getQualifyingMemberCount(
          client,
          userId,
          event.start_at
        );

      const prizesResult =
        await client.query(
          `
          SELECT
            id,
            required_members,
            prize_name,
            prize_type,
            prize_value
          FROM event_member_prizes
          WHERE event_id = $1
            AND active = TRUE
            AND required_members <= $2
          ORDER BY
            required_members ASC,
            display_order ASC
          `,
          [
            event.id,
            memberCount
          ]
        );

      for (
        const prize of prizesResult.rows
      ) {

        /*
         * Create the claim first.
         *
         * ON CONFLICT prevents the same
         * reward from ever being processed twice.
         */
        const claim =
          await client.query(
            `
            INSERT INTO event_member_reward_claims
              (
                event_id,
                prize_id,
                user_id,
                qualifying_member_count,
                prize_type,
                prize_value,
                status,
                credited_at
              )
            VALUES
              (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                'processing',
                NOW()
              )
            ON CONFLICT(user_id, prize_id)
            DO NOTHING
            RETURNING id
            `,
            [
              event.id,
              prize.id,
              userId,
              memberCount,
              prize.prize_type,
              prize.prize_value
            ]
          );

        /*
         * Already processed.
         */
        if (!claim.rowCount) {
          continue;
        }

        const claimId =
          claim.rows[0].id;

        const description =
          `Global Nexus Capital Event Reward: ${prize.prize_name}`;

        /*
         * POINTS
         */
        if (
          prize.prize_type === "points"
        ) {

          await creditPoints(
            client,
            {
              userId,
              eventId: event.id,
              amount: prize.prize_value,
              description
            }
          );

          await client.query(
            `
            UPDATE event_member_reward_claims
            SET
              status = 'credited',
              credited_at = NOW()
            WHERE id = $1
            `,
            [claimId]
          );

          results.push({
            eventId: event.id,
            event: event.name,
            prize: prize.prize_name,
            type: "points",
            status: "credited"
          });

          continue;
        }


        /*
         * CASH
         */
        if (
          prize.prize_type === "cash"
        ) {

          await creditCash(
            client,
            {
              userId,
              eventId: event.id,
              prizeId: prize.id,
              amount: prize.prize_value,
              description
            }
          );

          await client.query(
            `
            UPDATE event_member_reward_claims
            SET
              status = 'credited',
              credited_at = NOW()
            WHERE id = $1
            `,
            [claimId]
          );

          results.push({
            eventId: event.id,
            event: event.name,
            prize: prize.prize_name,
            type: "cash",
            status: "credited"
          });

          continue;
        }


        /*
         * LUCKY CARD DRAWS
         */
        if (
          prize.prize_type === "lucky_draw"
        ) {

          const drawAmount =
            Math.trunc(
              Number(prize.prize_value)
            );

          if (
            !Number.isInteger(drawAmount) ||
            drawAmount < 1
          ) {
            throw new Error(
              "Lucky Card draw reward must be at least 1."
            );
          }

          await client.query(
            `
            INSERT INTO lucky_card_balances
              (
                user_id,
                event_id,
                available_draws,
                updated_at
              )
            VALUES
              (
                $1,
                $2,
                $3,
                NOW()
              )
            ON CONFLICT
              (
                user_id,
                event_id
              )
            DO UPDATE SET
              available_draws =
                lucky_card_balances.available_draws +
                EXCLUDED.available_draws,
              updated_at = NOW()
            `,
            [
              userId,
              event.id,
              drawAmount
            ]
          );

          await client.query(
            `
            UPDATE event_member_reward_claims
            SET
              status = 'credited',
              credited_at = NOW()
            WHERE id = $1
            `,
            [claimId]
          );

          results.push({
            eventId: event.id,
            event: event.name,
            prize: prize.prize_name,
            type: "lucky_draw",
            draws: drawAmount,
            status: "credited"
          });

          continue;
        }


        /*
         * ITEM / SPECIAL PRIZE
         *
         * No automatic wallet or points credit.
         * The item is marked for manual fulfilment.
         */
        await client.query(
          `
          UPDATE event_member_reward_claims
          SET
            status = 'claim_item',
            credited_at = NOW()
          WHERE id = $1
          `,
          [claimId]
        );

        results.push({
          eventId: event.id,
          event: event.name,
          prize: prize.prize_name,
          type: "item",
          status: "claim_item"
        });
      }
    }

    await client.query("COMMIT");

    return {
      rewards: results
    };

  } catch (error) {

    await client.query("ROLLBACK");

    throw error;

  } finally {

    client.release();
  }
}


/*
 * Get active events visible to a user.
 *
 * IMPORTANT:
 * Event reward requirements remain private.
 *
 * Users only see rewards they have actually
 * unlocked through qualifying direct members.
 */
export async function getMemberEvents(
  userId
) {
  const db = getDb();

  /*
   * First process newly unlocked rewards.
   */
  await processMemberEventRewards(userId);


  const eventsResult =
    await db.query(
      `
      SELECT
        e.id,
        e.name,
        e.description,
        e.banner_url,
        e.start_at,
        e.end_at,
        e.status,

        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'prizeName', p.prize_name,
              'prizeType', p.prize_type,
              'prizeValue', p.prize_value,
              'claimed', c.id IS NOT NULL,
              'claimStatus', c.status
            )
            ORDER BY
              p.required_members ASC,
              p.display_order ASC
          ) FILTER (
            WHERE
              p.id IS NOT NULL
              AND c.id IS NOT NULL
          ),
          '[]'
        ) AS prizes

      FROM events e

      LEFT JOIN event_member_prizes p
        ON p.event_id = e.id
        AND p.active = TRUE

      LEFT JOIN event_member_reward_claims c
        ON c.prize_id = p.id
        AND c.user_id = $1

      WHERE e.status = 'active'
        AND e.start_at IS NOT NULL
        AND e.start_at <= NOW()
        AND (
          e.end_at IS NULL
          OR e.end_at >= NOW()
        )

      GROUP BY e.id

      ORDER BY e.start_at DESC
      `,
      [userId]
    );


  const events =
    eventsResult.rows.map(
      (event) => ({
        ...event,
        prizes:
          Array.isArray(event.prizes)
            ? event.prizes
            : []
      })
    );


  return {
    events
  };
}
