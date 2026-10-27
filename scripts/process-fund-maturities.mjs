import pg from "pg";
import { matureDueFunds } from "../lib/fund-maturity.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("[FUND-MATURITY] DATABASE_URL is missing.");
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

const lockKey = "cmc-fund-maturity-worker-v1";

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
        "[FUND-MATURITY] Another worker is running; skipping this run."
      );
      return;
    }

    const result = await matureDueFunds();

    console.log(
      JSON.stringify({
        worker: "fund-maturity",
        processed: result.length,
        items: result,
        completedAt: new Date().toISOString()
      })
    );
  } finally {
    if (locked) {
      try {
        await client.query(
          "SELECT pg_advisory_unlock(hashtext($1))",
          [lockKey]
        );
      } catch (error) {
        console.error(
          "[FUND-MATURITY] Could not release advisory lock:",
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
    "[FUND-MATURITY] Processing failed:",
    error?.message || String(error)
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
