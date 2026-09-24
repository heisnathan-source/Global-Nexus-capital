import bcrypt from "bcryptjs";

import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

function getUserSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session || null;
}

export async function POST(request) {
  const session = getUserSession(request);

  if (!session?.userId) {
    return Response.json(
      {
        error: "You must be logged in to change your password."
      },
      {
        status: 401
      }
    );
  }

  try {
    const body = await request.json();

    const currentPassword = String(
      body?.currentPassword || ""
    );

    const newPassword = String(
      body?.newPassword || ""
    );

    if (!currentPassword) {
      return Response.json(
        {
          error:
            "Current or temporary password is required."
        },
        {
          status: 400
        }
      );
    }

    if (!newPassword) {
      return Response.json(
        {
          error: "New password is required."
        },
        {
          status: 400
        }
      );
    }

    if (newPassword.length < 6) {
      return Response.json(
        {
          error:
            "New password must be at least 6 characters."
        },
        {
          status: 400
        }
      );
    }

    if (currentPassword === newPassword) {
      return Response.json(
        {
          error:
            "Your new password must be different from your current password."
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
        login_password_hash
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [session.userId]
    );

    if (!result.rowCount) {
      return Response.json(
        {
          error: "User account was not found."
        },
        {
          status: 404
        }
      );
    }

    const user = result.rows[0];

    const passwordCorrect = await bcrypt.compare(
      currentPassword,
      user.login_password_hash
    );

    if (!passwordCorrect) {
      return Response.json(
        {
          error:
            "Your current or temporary password is incorrect."
        },
        {
          status: 400
        }
      );
    }

    const passwordHash = await bcrypt.hash(
      newPassword,
      12
    );

    await db.query(
      `
      UPDATE users
      SET login_password_hash = $1
      WHERE id = $2
      `,
      [
        passwordHash,
        session.userId
      ]
    );

    return Response.json({
      ok: true,
      message:
        "Password changed successfully."
    });

  } catch (error) {

    console.error(
      "CHANGE PASSWORD ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to change your password."
      },
      {
        status: 500
      }
    );
  }
}
