import pg from "pg";
import { processMemberEventRewards } from "../lib/member-event-service.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("[EVENT-REWARD-WORKER] DATABASE_URL is missing.");
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

const lockKey = "smart-vision-event-reward-worker-v1";

async function main() {
  const client = await pool.connect();
  let locked = false;

  try {
    const lockResult = await client.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [lockKey]
    );

    locked = lockResult.rows[0].locked;

    if (!locked) {
      console.log(
        "[EVENT-REWARD-WORKER] Another worker is running; skipping this run."
      );
      return;
    }

    const events = await client.query(`
      SELECT
        e.id,
        e.name,
        e.start_at,
        p.required_members
      FROM public.events e
      JOIN public.event_member_prizes p
        ON p.event_id = e.id
      WHERE e.status = 'active'
        AND e.start_at <= NOW()
        AND (e.end_at IS NULL OR e.end_at >= NOW())
        AND p.active = TRUE
        AND p.prize_type = 'points'
        AND p.prize_value > 0
      ORDER BY e.start_at
    `);

    if (events.rowCount === 0) {
      console.log("[EVENT-REWARD-WORKER] No active points events.");
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
        [
          event.start_at,
          event.required_members
        ]
      );

      console.log(
        `[EVENT-REWARD-WORKER] Event "${event.name}": ` +
        `${sponsors.rowCount} sponsors to evaluate.`
      );

      for (const sponsor of sponsors.rows) {
        try {
          const result = await processMemberEventRewards(
            sponsor.user_id
          );

          console.log(
            "[EVENT-REWARD-WORKER] Processed sponsor.",
            {
              eventId: event.id,
              userId: sponsor.user_id,
              rewardsReturned: result?.rewards?.length ?? 0
            }
          );
        } catch (error) {
          console.error(
            "[EVENT-REWARD-WORKER] Sponsor processing failed.",
            {
              eventId: event.id,
              userId: sponsor.user_id,
              message: error?.message || String(error)
            }
          );
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
        console.error(
          "[EVENT-REWARD-WORKER] Could not release advisory lock:",
          error.message
        );
      }
    }

    client.release();
  }
}

try {
  await main();
} catch (error) {
  console.error(
    "[EVENT-REWARD-WORKER] Fatal error:",
    error?.message || String(error)
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
