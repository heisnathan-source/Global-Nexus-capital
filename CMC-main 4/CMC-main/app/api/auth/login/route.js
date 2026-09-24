import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db.js";
import {
  createSessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

export async function POST(request) {
  try {
    const body = await request.json();

    const phone = body?.phone;
    const password = body?.password;

    if (!phone || !password) {
      return Response.json(
        {
          error:
            "Phone and password are required."
        },
        {
          status: 400
        }
      );
    }

    const db = getDb();

    const result = await db.query(
      `
      SELECT
        id,
        login_password_hash,
        role,
        enabled
      FROM users
      WHERE phone = $1
        AND role = 'user'
      `,
      [phone]
    );

    if (!result.rowCount) {
      return Response.json(
        {
          error: "Invalid credentials."
        },
        {
          status: 401
        }
      );
    }

    const user = result.rows[0];
 
   if (!user.enabled) {
  return Response.json(
    {
      error:
        "Your account has been suspended. Please contact Global Nexus Capital support."
    },
    {
      status: 403
    }
  );
}
    const passwordCorrect =
      await bcrypt.compare(
        password,
        user.login_password_hash
      );

    if (!passwordCorrect) {
      return Response.json(
        {
          error: "Invalid credentials."
        },
        {
          status: 401
        }
      );
    }

    const token =
      createSessionToken(
        user.id,
        "user"
      );

    const response = Response.json({
      ok: true
    });

    response.headers.append(
      "Set-Cookie",
      [
        `${USER_COOKIE_NAME}=${token}`,
        "HttpOnly",
        "SameSite=Lax",
        "Path=/",
        "Max-Age=86400",
        process.env.NODE_ENV === "production"
          ? "Secure"
          : ""
      ]
        .filter(Boolean)
        .join("; ")
    );

    return response;

  } catch (error) {

    console.error(
      "USER LOGIN ERROR:",
      error
    );

    return Response.json(
      {
        error: "Unable to log in."
      },
      {
        status: 500
      }
    );
  }
}
