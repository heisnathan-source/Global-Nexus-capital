import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME,
} from "@/lib/session.js";

function session(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const sessionData = match
    ? verifySessionToken(match[1])
    : null;

  return sessionData &&
    sessionData.role === "user"
    ? sessionData
    : null;
}

export async function GET(request) {
  const sessionData = session(request);

  if (!sessionData) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const result = await db.query(
      `
      SELECT
        b.id,
        b.name,
        b.description,
        b.image_url,
        b.display_order,
        r.name AS rank_name
      FROM member_benefits b
      LEFT JOIN ranks r
        ON r.id = b.rank_id
      WHERE b.active = TRUE
        AND (
          b.rank_id IS NULL
          OR b.rank_id = (
            SELECT rank_id
            FROM users
            WHERE id = $1
          )
        )
      ORDER BY
        b.display_order,
        b.created_at DESC
      `,
      [sessionData.userId]
    );

    return Response.json({
      benefits: result.rows,
    });
  } catch (error) {
    console.error(
      "Member benefits API error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load member benefits.",
      },
      { status: 500 }
    );
  }
}
