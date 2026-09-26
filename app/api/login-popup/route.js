import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

function userSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const token = match ? match[1] : null;

  const session = token
    ? verifySessionToken(token)
    : null;

  return session && session.role === "user"
    ? session
    : null;
}

export async function GET(request) {
  const session = userSession(request);

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
        page_key,
        title,
        content,
        banner_url,
        active,
        updated_at
      FROM content_pages
      WHERE page_key = 'login_popup'
        AND active = TRUE
      LIMIT 1
      `
    );

    if (!result.rowCount) {
      return Response.json({
        popup: null
      });
    }

    return Response.json({
      popup: result.rows[0]
    });
  } catch (error) {
    console.error(
      "Login popup GET error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load login popup."
      },
      {
        status: 500
      }
    );
  }
}
