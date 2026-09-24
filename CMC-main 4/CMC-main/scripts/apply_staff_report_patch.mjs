import fs from "fs";
import pg from "pg";

const { Pool } = pg;

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;

  const text = fs.readFileSync(path, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/
    );

    if (!match) continue;

    let [, key, value] = match;

    value = value.trim();

    if (
      (value.startsWith('"') &&
        value.endsWith('"')) ||
      (value.startsWith("'") &&
        value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const connectionString =
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set."
  );
}

const pool = new Pool({
  connectionString,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

const sql = fs.readFileSync(
  "db/patch_2026_09_16_staff_report_exclusions.sql",
  "utf8"
);

const client = await pool.connect();

try {
  await client.query(sql);

  console.log(
    "Staff report exclusions database patch applied successfully."
  );
} finally {
  client.release();
  await pool.end();
}
