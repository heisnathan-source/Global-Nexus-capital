import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db.js";
import {
  createSessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

async function recordLoginActivity({
  db,
  userId = null,
  phone = null,
  ipAddress = null,
  userAgent = null,
  eventType,
  failureReason = null
}) {
  try {
    await db.query(
      `
      INSERT INTO login_activity (
        user_id,
        role,
        phone,
        ip_address,
        user_agent,
        event_type,
        failure_reason
      )
      VALUES ($1, 'admin', $2, $3, $4, $5, $6)
      `,
      [
        userId,
        phone,
        ipAddress,
        userAgent,
        eventType,
        failureReason
      ]
    );
  } catch (error) {
    console.error(
      "ADMIN LOGIN ACTIVITY RECORD ERROR:",
      error
    );
  }
}

export async function POST(request) {
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || null;

  try {
    const body = await request.json();

    const phone = body?.phone;
    const password = body?.password;

    const normalized = String(phone || "").replace(/\s/g, "");

    const db = getDb();

    if (!normalized || !password) {
      await recordLoginActivity({
        db,
        phone: normalized || null,
        ipAddress,
        userAgent,
        eventType: "login_failed",
        failureReason: "missing_credentials"
      });

      return Response.json(
        {
          error: "Phone and password are required."
        },
        {
          status: 400
        }
      );
    }

    const result = await db.query(
      `
      SELECT
        id,
        login_password_hash,
        role
      FROM users
      WHERE phone = $1
        AND role = 'admin'
      LIMIT 1
      `,
      [normalized]
    );

    if (!result.rowCount) {
      await recordLoginActivity({
        db,
        phone: normalized,
        ipAddress,
        userAgent,
        eventType: "login_failed",
        failureReason: "invalid_credentials"
      });

      return Response.json(
        {
          error: "Invalid Admin credentials."
        },
        {
          status: 401
        }
      );
    }

    const admin = result.rows[0];

    const passwordCorrect =
      await bcrypt.compare(
        password,
        admin.login_password_hash
      );

    if (!passwordCorrect) {
      await recordLoginActivity({
        db,
        userId: admin.id,
        phone: normalized,
        ipAddress,
        userAgent,
        eventType: "login_failed",
        failureReason: "invalid_credentials"
      });

      return Response.json(
        {
          error: "Invalid Admin credentials."
        },
        {
          status: 401
        }
      );
    }

    await recordLoginActivity({
      db,
      userId: admin.id,
      phone: normalized,
      ipAddress,
      userAgent,
      eventType: "login_success"
    });

    const token =
      createSessionToken(
        admin.id,
        "admin"
      );

    return new Response(
      JSON.stringify({
        ok: true
      }),
      {
        status: 200,
        headers: {
          "content-type":
            "application/json",
          "set-cookie":
            `${ADMIN_COOKIE_NAME}=${token}; HttpOnly${process.env.NODE_ENV === "production" ? "; Secure" : ""}; SameSite=Lax; Path=/; Max-Age=86400`
        }
      }
    );

  } catch (error) {
    console.error(
      "ADMIN LOGIN ERROR:",
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
