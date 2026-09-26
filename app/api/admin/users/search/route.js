import { getDb } from "@/lib/db.js";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/session.js";

function adminSession(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const session = match ? verifySessionToken(match[1]) : null;

  return session && session.role === "admin" ? session : null;
}

export async function GET(request) {
  const session = adminSession(request);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  const search = q ? `%${q}%` : "%";
  const db = getDb();

  const result = await db.query(
    `
    SELECT
      u.id,
      u.account_id,
      u.name,
      u.phone,
      u.registration_date,
      u.identity_status,
      u.withdrawal_enabled,
      u.enabled,
      u.rank_id,
      COALESCE(r.name, 'STARTER') AS rank_name,
      COALESCE(w.available_balance, 0) AS available_balance,
      COALESCE(w.reserved_balance, 0) AS reserved_balance
    FROM users u
    LEFT JOIN wallets w ON w.user_id = u.id
    LEFT JOIN ranks r ON r.id = u.rank_id
    WHERE u.name ILIKE $1
       OR u.phone ILIKE $1
       OR u.id::text ILIKE $1
       OR u.account_id ILIKE $1
       OR ('CMC-' || RIGHT(REPLACE(u.id::text, '-', ''), 8)) ILIKE $1
    ORDER BY u.registration_date DESC
    LIMIT 50
    `,
    [search]
  );

  return Response.json({ users: result.rows });
}
