import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

const ALLOWED_AVATARS = new Set([
  "cmc-avatar-1",
  "cmc-avatar-2",
]);

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
        COALESCE(avatar_id, 'cmc-avatar-1') AS avatar_id
      FROM users
      WHERE id = $1
        AND role = 'user'
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
      avatarId: result.rows[0].avatar_id
    });

  } catch (error) {
    console.error("GET AVATAR ERROR:", error);

    return Response.json(
      { error: "Unable to load avatar selection." },
      { status: 500 }
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

    const avatarId = String(
      body?.avatarId || ""
    ).trim();

    if (!ALLOWED_AVATARS.has(avatarId)) {
      return Response.json(
        { error: "Invalid avatar selection." },
        { status: 400 }
      );
    }

    const db = getDb();

    const result = await db.query(
      `
      UPDATE users
      SET avatar_id = $1
      WHERE id = $2
        AND role = 'user'
        AND enabled = TRUE
      RETURNING id, avatar_id
      `,
      [
        avatarId,
        session.userId
      ]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Account not found or unavailable." },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      avatarId: result.rows[0].avatar_id
    });

  } catch (error) {
    console.error("SAVE AVATAR ERROR:", error);

    return Response.json(
      { error: "Unable to save avatar selection." },
      { status: 500 }
    );
  }
}
