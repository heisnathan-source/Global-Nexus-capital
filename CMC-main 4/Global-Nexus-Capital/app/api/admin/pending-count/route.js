import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

function adminSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const token = match ? match[1] : null;
  const session = token
    ? verifySessionToken(token)
    : null;

  return session && session.role === "admin"
    ? session
    : null;
}

export async function GET(request) {
  const admin = adminSession(request);

  if (!admin) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const deposits = await db.query(`
      SELECT COUNT(*)::int AS count
      FROM deposit_orders
      WHERE status = 'payment_submitted'
    `);

    const withdrawals = await db.query(`
      SELECT COUNT(*)::int AS count
      FROM withdrawal_orders
      WHERE status = 'pending'
    `);

    const depositCount = deposits.rows[0].count;
    const withdrawalCount = withdrawals.rows[0].count;

    return Response.json({
      deposits: depositCount,
      withdrawals: withdrawalCount,
      total: depositCount + withdrawalCount
    });
  } catch (error) {
    console.error(
      "GET /api/admin/pending-count error:",
      error
    );

    return Response.json(
      {
        error: "Unable to load pending action counts."
      },
      { status: 500 }
    );
  }
}
