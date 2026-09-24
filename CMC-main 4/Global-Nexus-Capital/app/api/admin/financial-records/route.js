import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function admin(r) {
  const c = r.headers.get("cookie") || "";
  const m = c.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
  const s = m ? verifySessionToken(m[1]) : null;
  return s && s.role === "admin" ? s : null;
}

export async function GET(r) {
  if (!admin(r)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();

    const [t, w] = await Promise.all([
      db.query(
        `SELECT
          id,
          user_id,
          type,
          amount,
          fee,
          status,
          reference,
          created_at
        FROM transactions
        ORDER BY created_at DESC
        LIMIT 500`
      ),
      db.query(
        `SELECT
          COALESCE(
            SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),
            0
          ) credits,
          COALESCE(
            SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END),
            0
          ) debits
        FROM wallet_ledger`
      ),
    ]);

    return Response.json({
      records: t.rows,
      totals: w.rows[0],
    });
  } catch (e) {
    console.error("Admin financial records GET failed:", e);

    return Response.json(
      { error: "Unable to load financial records." },
      { status: 500 }
    );
  }
}
