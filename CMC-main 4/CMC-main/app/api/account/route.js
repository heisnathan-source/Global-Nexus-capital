import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

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
        u.id,
        u.phone,
        u.identity_status,
        u.rank_id,
        u.enabled,
        u.avatar_id,

        COALESCE(
          u.registration_date,
          u.created_at
        ) AS registration_date,

        (
          u.funds_password_hash IS NOT NULL
        ) AS has_funds_password,

        COALESCE(
          r.name,
          'STARTER'
        ) AS rank_name,

        COALESCE(
          w.available_balance,
          0
        ) AS balance,

        COALESCE(
          up.language,
          'English'
        ) AS language,

        COALESCE(
          up.notifications_enabled,
          TRUE
        ) AS notifications_enabled

      FROM users u

      LEFT JOIN ranks r
        ON r.id = u.rank_id

      LEFT JOIN wallets w
        ON w.user_id = u.id

      LEFT JOIN user_preferences up
        ON up.user_id = u.id

      WHERE u.id = $1
      `,
      [session.userId]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Account not found." },
        { status: 404 }
      );
    }

    const account = result.rows[0];

    if (account.enabled === false) {
      const response = Response.json(
        {
          error:
            "Your account has been suspended. Please contact Global Nexus Capital support.",
          suspended: true
        },
        {
          status: 403
        }
      );

      response.headers.append(
        "Set-Cookie",
        [
          `${USER_COOKIE_NAME}=`,
          "HttpOnly",
          "SameSite=Lax",
          "Path=/",
          "Max-Age=0",
          process.env.NODE_ENV === "production"
            ? "Secure"
            : ""
        ]
          .filter(Boolean)
          .join("; ")
      );

      return response;
    }

    return Response.json({
      account
    });

  } catch (error) {
    console.error(
      "ACCOUNT API ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load account information."
      },
      {
        status: 500
      }
    );
  }
}
