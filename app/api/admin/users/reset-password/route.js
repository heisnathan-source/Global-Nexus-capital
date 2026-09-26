import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function adminSession(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const m = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const s = m
    ? verifySessionToken(m[1])
    : null;

  return s && s.role === "admin"
    ? s
    : null;
}

function generateTemporaryPassword() {
  return crypto
    .randomBytes(9)
    .toString("base64url");
}

export async function POST(request) {
  const session =
    adminSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body;

  try {
    body =
      await request.json();
  } catch {
    return Response.json(
      {
        error:
          "Invalid request data."
      },
      { status: 400 }
    );
  }

  try {
    const userId =
      String(
        body?.userId || ""
      ).trim();

    if (!userId) {
      return Response.json(
        {
          error:
            "User is required."
        },
        { status: 400 }
      );
    }

    const db =
      getDb();

    const target =
      await db.query(
        `
        SELECT
          id,
          role,
          enabled
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
      );

    if (!target.rowCount) {
      return Response.json(
        {
          error:
            "User not found."
        },
        { status: 404 }
      );
    }

    if (
      target.rows[0].role !==
      "user"
    ) {
      return Response.json(
        {
          error:
            "Login passwords can only be reset for user accounts."
        },
        { status: 400 }
      );
    }

    if (
      !target.rows[0].enabled
    ) {
      return Response.json(
        {
          error:
            "Login password cannot be reset for a disabled user account."
        },
        { status: 400 }
      );
    }

    const temporaryPassword =
      generateTemporaryPassword();

    const hash =
      await bcrypt.hash(
        temporaryPassword,
        12
      );

    await db.query(
      `
      UPDATE users
      SET login_password_hash = $1
      WHERE id = $2
        AND role = 'user'
        AND enabled = TRUE
      `,
      [hash, userId]
    );

    await db.query(
      `
      INSERT INTO audit_logs(
        id,
        admin_user_id,
        action,
        entity_type,
        entity_id,
        new_value,
        created_at
      )
      VALUES(
        $1,
        $2,
        'reset_login_password',
        'user',
        $3,
        $4,
        NOW()
      )
      `,
      [
        crypto.randomUUID(),
        session.userId,
        userId,
        JSON.stringify({
          reset: true
        }),
      ]
    );

    return Response.json({
      ok: true,
      temporaryPassword,
    });

  } catch (error) {
    console.error(
      "Admin login password reset failed:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to reset login password."
      },
      { status: 500 }
    );
  }
}
