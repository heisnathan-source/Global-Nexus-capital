import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

const ALLOWED_AVATARS = [
  "avatar1",
  "avatar2"
];

function getSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session && session.role === "user"
    ? session
    : null;
}

export async function GET(request) {
  const session = getSession(request);

  if (!session) {
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
        COALESCE(
          selected_avatar,
          'avatar1'
        ) AS selected_avatar
      FROM users
      WHERE id = $1
      `,
      [session.userId]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Account not found." },
        { status: 404 }
      );
    }

    return Response.json({
      selected_avatar:
        result.rows[0].selected_avatar
    });

  } catch (error) {
    console.error(
      "GET AVATAR ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load avatar selection."
      },
      {
        status: 500
      }
    );
  }
}

export async function POST(request) {
  const session = getSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const avatar =
      String(
        body?.avatar || ""
      ).trim();

    if (!ALLOWED_AVATARS.includes(avatar)) {
      return Response.json(
        {
          error:
            "Invalid avatar selection."
        },
        {
          status: 400
        }
      );
    }

    const db = getDb();

    const result = await db.query(
      `
      UPDATE users
      SET selected_avatar = $1
      WHERE id = $2
      RETURNING
        id,
        selected_avatar
      `,
      [
        avatar,
        session.userId
      ]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Account not found." },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      selected_avatar:
        result.rows[0].selected_avatar
    });

  } catch (error) {
    console.error(
      "SAVE AVATAR ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to save avatar selection."
      },
      {
        status: 500
      }
    );
  }
}
