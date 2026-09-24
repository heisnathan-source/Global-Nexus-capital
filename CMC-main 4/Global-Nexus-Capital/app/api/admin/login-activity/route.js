import { getDb } from "@/lib/db.js";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  verifySessionToken
} from "@/lib/session.js";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  const session = verifySessionToken(token);

  if (!session || session.role !== "admin") {
    return null;
  }

  return session;
}

export async function GET(request) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return Response.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const search =
      String(
        searchParams.get("search") || ""
      ).trim();

    const limitRaw =
      Number(
        searchParams.get("limit") || 200
      );

    const limit = Math.min(
      Math.max(
        Number.isFinite(limitRaw)
          ? Math.floor(limitRaw)
          : 200,
        1
      ),
      500
    );

    const db = getDb();

    const result = await db.query(
      `
      SELECT
        la.id,
        la.user_id,
        la.role,
        la.phone,
        la.ip_address::text AS ip_address,
        la.user_agent,
        la.event_type,
        la.failure_reason,
        la.created_at,
        u.name AS user_name,
        u.account_id
      FROM login_activity la
      LEFT JOIN users u
        ON u.id = la.user_id
      WHERE
        $1 = ''
        OR COALESCE(u.name, '') ILIKE '%' || $1 || '%'
        OR COALESCE(la.phone, '') ILIKE '%' || $1 || '%'
        OR COALESCE(la.ip_address::text, '') ILIKE '%' || $1 || '%'
        OR COALESCE(la.user_id::text, '') ILIKE '%' || $1 || '%'
        OR COALESCE(u.account_id, '') ILIKE '%' || $1 || '%'
      ORDER BY la.created_at DESC
      LIMIT $2
      `,
      [search, limit]
    );

    return Response.json({
      ok: true,
      activities: result.rows
    });

  } catch (error) {
    console.error(
      "LOGIN ACTIVITY ADMIN API ERROR:",
      error
    );

    return Response.json(
      {
        error: "Unable to load login activity."
      },
      {
        status: 500
      }
    );
  }
}
