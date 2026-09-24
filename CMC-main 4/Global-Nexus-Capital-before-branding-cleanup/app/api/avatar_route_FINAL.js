import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

const VALID_AVATARS = new Set([
  "avatar-1",
  "avatar-2",
  "avatar-3",
  "avatar-4",
  "avatar-5",
  "avatar-6",
  "avatar-7",
  "avatar-8",
  "avatar-9",
  "avatar-10",
  "avatar-11",
  "avatar-12",
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
    const avatarId = String(body?.avatarId || "").trim();

    if (!VALID_AVATARS.has(avatarId)) {
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
      RETURNING avatar_id
      `,
      [avatarId, session.userId]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Account not found or unavailable." },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      avatarId: result.rows[0].avatar_id,
    });
  } catch (error) {
    console.error("ACCOUNT AVATAR API ERROR:", error);

    return Response.json(
      { error: "Unable to save avatar." },
      { status: 500 }
    );
  }
}
