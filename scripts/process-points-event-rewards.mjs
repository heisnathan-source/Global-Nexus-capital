import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("[POINTS-WORKER] DATABASE_URL is missing.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  max: 3
});

const lockKey = "smart-vision-points-worker-v1";
const dryRun = process.env.DRY_RUN === "true";

async function main() {
  console.log(`[POINTS-WORKER] Mode: ${dryRun ? "DRY RUN (no database writes)" : "LIVE"}.`);
  const client = await pool.connect();
  let locked = false;

  try {
    const lockResult = await client.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [lockKey]
    );

    locked = lockResult.rows[0].locked;

    if (!locked) {
      console.log("[POINTS-WORKER] Another worker is running; skipping.");
      return;
    }

    const events = await client.query(`
      SELECT
        e.id AS event_id,
        e.name AS event_name,
        e.start_at,
        p.id AS prize_id,
        p.prize_name,
        p.prize_value,
        p.required_members
      FROM public.events e
      JOIN public.event_member_prizes p
        ON p.event_id = e.id
      WHERE e.status = 'active'
        AND e.start_at IS NOT NULL
        AND e.start_at <= NOW()
        AND (e.end_at IS NULL OR e.end_at >= NOW())
        AND p.active = TRUE
        AND p.prize_type = 'points'
        AND p.prize_value > 0
      ORDER BY e.start_at, p.required_members
    `);

    if (events.rowCount === 0) {
      console.log("[POINTS-WORKER] No active points prizes.");
      return;
    }

    for (const event of events.rows) {
      const sponsors = await client.query(
        `
        SELECT
          dr.sponsor_user_id AS user_id,
          COUNT(*)::int AS qualifying_count
        FROM public.direct_referrals dr
        WHERE (
          LOWER(COALESCE(dr.qualifying_status, '')) IN (
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
          AND dr.qualified_at >= $1
        GROUP BY dr.sponsor_user_id
        HAVING COUNT(*) >= $2
        ORDER BY dr.sponsor_user_id
        `,
        [event.start_at, event.required_members]
      );

      console.log(
        `[POINTS-WORKER] ${event.event_name}: ` +
        `${sponsors.rowCount} sponsors eligible for evaluation.`
      );

      for (const sponsor of sponsors.rows) {
        const rewardClient = await pool.connect();

        try {
          await rewardClient.query("BEGIN");

          const countResult = await rewardClient.query(
            `
            SELECT COUNT(*)::int AS count
            FROM public.direct_referrals dr
            WHERE dr.sponsor_user_id = $1
              AND (
                LOWER(COALESCE(dr.qualifying_status, '')) IN (
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
            [sponsor.user_id, event.start_at]
          );

          const qualifyingCount = Number(countResult.rows[0]?.count || 0);

          if (qualifyingCount < Number(event.required_members)) {
            await rewardClient.query("ROLLBACK");
            continue;
          }

          const points = Math.round(Number(event.prize_value));

          if (!Number.isFinite(points) || points <= 0) {
            throw new Error("Points reward must be a positive number.");
          }

          if (dryRun) {
            const existingClaim = await rewardClient.query(
              `
              SELECT id, status
              FROM public.event_member_reward_claims
              WHERE event_id = $1
                AND prize_id = $2
                AND user_id = $3
                AND prize_type <> 'lucky_draw'
              LIMIT 1
              `,
              [event.event_id, event.prize_id, sponsor.user_id]
            );

            await rewardClient.query("ROLLBACK");

            if (existingClaim.rowCount > 0) {
              console.log("[POINTS-WORKER] DRY RUN: existing claim; would skip.", {
                eventId: event.event_id,
                userId: sponsor.user_id,
                claimStatus: existingClaim.rows[0].status
              });
            } else {
              console.log("[POINTS-WORKER] DRY RUN: eligible reward; no changes made.", {
                eventId: event.event_id,
                eventName: event.event_name,
                prizeId: event.prize_id,
                prizeName: event.prize_name,
                userId: sponsor.user_id,
                qualifyingCount,
                points
              });
            }

            continue;
          }

          const claim = await rewardClient.query(
            `
            INSERT INTO public.event_member_reward_claims (
              event_id,
              prize_id,
              user_id,
              qualifying_member_count,
              prize_type,
              prize_value,
              status,
              credited_at
            )
            VALUES ($1, $2, $3, $4, 'points', $5, 'processing', NOW())
            ON CONFLICT DO NOTHING
            RETURNING id
            `,
            [
              event.event_id,
              event.prize_id,
              sponsor.user_id,
              qualifyingCount,
              event.prize_value
            ]
          );

          if (claim.rowCount === 0) {
            await rewardClient.query("ROLLBACK");
            continue;
          }

          await rewardClient.query(
            `
            INSERT INTO public.point_accounts (user_id, balance, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
              balance = public.point_accounts.balance + EXCLUDED.balance,
              updated_at = NOW()
            `,
            [sponsor.user_id, points]
          );

          await rewardClient.query(
            `
            INSERT INTO public.point_ledger (
              user_id, event_id, type, points, description, created_at
            )
            VALUES ($1, $2, 'award', $3, $4, NOW())
            `,
            [
              sponsor.user_id,
              event.event_id,
              points,
              `Global Nexus Capital Event Reward: ${event.prize_name}`
            ]
          );

          await rewardClient.query(
            `
            UPDATE public.event_member_reward_claims
            SET status = 'credited', credited_at = NOW()
            WHERE id = $1
            `,
            [claim.rows[0].id]
          );

          await rewardClient.query("COMMIT");

          console.log("[POINTS-WORKER] Points reward credited.", {
            eventId: event.event_id,
            userId: sponsor.user_id,
            points
          });
        } catch (error) {
          try {
            await rewardClient.query("ROLLBACK");
          } catch {}

          console.error("[POINTS-WORKER] Sponsor processing failed.", {
            eventId: event.event_id,
            userId: sponsor.user_id,
            message: error?.message || String(error)
          });
        } finally {
          rewardClient.release();
        }
      }
    }
  } finally {
    if (locked) {
      try {
        await client.query(
          "SELECT pg_advisory_unlock(hashtext($1))",
          [lockKey]
        );
      } catch (error) {
        console.error("[POINTS-WORKER] Could not release lock:", error.message);
      }
    }

    client.release();
  }
}

const requestedIntervalMs = Number(
  process.env.REWARD_INTERVAL_MS || 300_000
);

const intervalMs = Number.isFinite(requestedIntervalMs)
  ? Math.max(60_000, requestedIntervalMs)
  : 300_000;

let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`[POINTS-WORKER] Received ${signal}; stopping after the current cycle.`);
    stopping = true;
  });
}

try {
  while (!stopping) {
    try {
      await main();
    } catch (error) {
      console.error("[POINTS-WORKER] Cycle failed:", error?.message || String(error));
    }

    if (stopping) break;

    console.log(
      `[POINTS-WORKER] Next check in ${Math.round(intervalMs / 1000)} seconds.`
    );

    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }
} finally {
  await pool.end();
  console.log("[POINTS-WORKER] Database pool closed.");
}
