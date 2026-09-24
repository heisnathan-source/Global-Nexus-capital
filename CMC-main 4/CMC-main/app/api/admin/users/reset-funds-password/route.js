import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function adminSession(request) {
  const c = request.headers.get("cookie") || "";
  const m = c.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const s = m ? verifySessionToken(m[1]) : null;

  return s && s.role === "admin"
    ? s
    : null;
}

function generateFundsPassword() {
  const value =
    crypto.randomInt(100000, 1000000);

  return String(value);
}

export async function POST(request) {
  const session = adminSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request data." },
      { status: 400 }
    );
  }

  try {
    const userId =
      String(body?.userId || "").trim();

    if (!userId) {
      return Response.json(
        { error: "User is required." },
        { status: 400 }
      );
    }

    const db = getDb();

    const target = await db.query(
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
        { error: "User not found." },
        { status: 404 }
      );
    }

    if (target.rows[0].role !== "user") {
      return Response.json(
        {
          error:
            "Funds passwords can only be reset for user accounts."
        },
        { status: 400 }
      );
    }

    if (!target.rows[0].enabled) {
      return Response.json(
        {
          error:
            "Funds password cannot be reset for a disabled user account."
        },
        { status: 400 }
      );
    }

    const fundsPassword =
      generateFundsPassword();

    const hash =
      await bcrypt.hash(
        fundsPassword,
        12
      );

    await db.query(
      `
      UPDATE users
      SET funds_password_hash = $1
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
        'reset_funds_password',
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
      fundsPassword,
    });

  } catch (error) {
    console.error(
      "Admin funds password reset failed:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to reset funds password."
      },
      { status: 500 }
    );
  }
}
