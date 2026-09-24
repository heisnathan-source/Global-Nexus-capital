import { NextResponse } from "next/server";
import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

function getAdminSession(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  if (!match) return null;

  const session = verifySessionToken(match[1]);

  return session && session.role === "admin"
    ? session
    : null;
}

export async function GET(request) {
  const session = getAdminSession(request);

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const db = getDb();

  try {
    const result = await db.query(`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (
          WHERE rank_id IS NOT NULL
        )::int AS qualified_users,
        COUNT(*) FILTER (
          WHERE rank_id IS NULL
        )::int AS unqualified_users
      FROM users
      WHERE role = 'user'
    `);

    const row = result.rows[0];

    return NextResponse.json({
      total: Number(row.total_users || 0),
      qualified: Number(row.qualified_users || 0),
      unqualified: Number(row.unqualified_users || 0)
    });
  } catch (error) {
    console.error("Admin user stats error:", error);

    return NextResponse.json(
      { error: "Unable to load user statistics." },
      { status: 500 }
    );
  }
}
