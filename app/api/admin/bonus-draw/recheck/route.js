import { getDb } from "@/lib/db.js";

import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

import {
  processBonusDrawForUser
} from "@/lib/bonus-draw-service.js";

function getAdminSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session && session.role === "admin"
    ? session
    : null;
}

export async function GET(request) {
  const admin = getAdminSession(request);

  if (!admin) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } =
      new URL(request.url);

    const query =
      searchParams.get("query")?.trim();

    if (!query) {
      return Response.json({
        users: []
      });
    }

    const db = getDb();

    const result = await db.query(
      `
      SELECT
        id,
        name,
        account_id,
        phone,
        phone_number
      FROM users
      WHERE
        LOWER(COALESCE(name, ''))
          LIKE LOWER($1)

        OR LOWER(COALESCE(account_id, ''))
          LIKE LOWER($1)

        OR COALESCE(phone, '')
          LIKE $1

        OR COALESCE(phone_number, '')
          LIKE $1

        OR CAST(id AS TEXT)
          LIKE $1

      ORDER BY created_at DESC
      LIMIT 20
      `,
      [`%${query}%`]
    );

    return Response.json({
      users: result.rows
    });

  } catch (error) {
    console.error(
      "Bonus Draw user search error:",
      error
    );

    return Response.json(
      {
        error: "Unable to search users."
      },
      { status: 400 }
    );
  }
}

export async function POST(request) {
  const admin = getAdminSession(request);

  if (!admin) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { userId } =
      await request.json();

    if (!userId) {
      throw new Error(
        "User selection is required."
      );
    }

    const db = getDb();

    /*
      Confirm that the UUID belongs
      to an existing user.
    */
    const userResult = await db.query(
      `
      SELECT
        id,
        name,
        account_id
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (!userResult.rowCount) {
      throw new Error(
        "Selected user was not found."
      );
    }

    const result =
      await processBonusDrawForUser(
        userId
      );

    return Response.json({
      success: true,
      user: userResult.rows[0],
      result
    });

  } catch (error) {
    console.error(
      "Bonus Draw recheck error:",
      error
    );

    return Response.json(
      {
        error: "Unable to recheck Bonus Draw rewards."
      },
      { status: 400 }
    );
  }
}
