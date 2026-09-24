import fs from "fs";
import path from "path";
import pg from "pg";

function loadDotEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);

    if (!fs.existsSync(full)) continue;

    for (const line of fs
      .readFileSync(full, "utf8")
      .split(/\r?\n/)) {

      const match = line.match(
        /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/
      );

      if (!match || process.env[match[1]]) continue;

      let value = match[2].trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[match[1]] = value;
    }
  }
}

loadDotEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

const sqlPath = path.join(
  process.cwd(),
  "db",
  "patch_2026_09_05_password_recovery.sql"
);

const sql = fs.readFileSync(sqlPath, "utf8");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false }
});

try {
  await pool.query(sql);

  console.log(
    "Global Nexus Capital password recovery database patch applied successfully."
  );

} catch (error) {

  console.error(
    "Global Nexus Capital password recovery database patch failed:"
  );

  console.error(error.message);

  process.exitCode = 1;

} finally {

  await pool.end();

}
