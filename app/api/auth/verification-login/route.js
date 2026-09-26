import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db.js";
import {
  createSessionToken,
  VERIFICATION_COOKIE_NAME,
} from "@/lib/session.js";

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeLogin(value) {
  return clean(value).replace(/\s+/g, "");
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }

  const staffLogin = normalizeLogin(
    body.staffLogin ?? body.phone
  );

  const password = String(
    body.password ?? ""
  );

  if (!staffLogin || !password) {
    return NextResponse.json(
      {
        error:
          "Login number and password are required.",
      },
      { status: 400 }
    );
  }

  const db = getDb();

  try {
    const result = await db.query(
      `
      SELECT
        id,
        name,
        staff_login,
        login_password_hash,
        enabled
      FROM users
      WHERE staff_login = $1
        AND role = 'verification_staff'
      LIMIT 1
      `,
      [staffLogin]
    );

    if (!result.rowCount) {
      /*
       * Record failed staff login without exposing
       * whether the login number exists.
       */
      try {
        await db.query(
          `
          INSERT INTO login_activity (
            user_id,
            phone,
            role,
            event_type,
            failure_reason,
            ip_address,
            user_agent
          )
          VALUES (
            NULL,
            $1,
            'verification_staff',
            'login_failure',
            $2,
            $3,
            $4
          )
          `,
          [
            staffLogin,
            "invalid_credentials",
            getClientIp(request),
            request.headers.get(
              "user-agent"
            ) || null,
          ]
        );
      } catch (error) {
        console.error(
          "verification staff failed-login activity error:",
          error
        );
      }

      return NextResponse.json(
        { error: "Invalid login details." },
        { status: 401 }
      );
    }

    const staff = result.rows[0];

    if (!staff.enabled) {
      try {
        await db.query(
          `
          INSERT INTO login_activity (
            user_id,
            phone,
            role,
            event_type,
            failure_reason,
            ip_address,
            user_agent
          )
          VALUES (
            $1,
            $2,
            'verification_staff',
            'login_failure',
            'account_disabled',
            $3,
            $4
          )
          `,
          [
            staff.id,
            staff.staff_login,
            getClientIp(request),
            request.headers.get(
              "user-agent"
            ) || null,
          ]
        );
      } catch (error) {
        console.error(
          "verification staff disabled-login activity error:",
          error
        );
      }

      return NextResponse.json(
        {
          error:
            "This staff account has been disabled.",
        },
        { status: 403 }
      );
    }

    const validPassword =
      await bcrypt.compare(
        password,
        staff.login_password_hash
      );

    if (!validPassword) {
      try {
        await db.query(
          `
          INSERT INTO login_activity (
            user_id,
            phone,
            role,
            event_type,
            failure_reason,
            ip_address,
            user_agent
          )
          VALUES (
            $1,
            $2,
            'verification_staff',
            'login_failure',
            'invalid_credentials',
            $3,
            $4
          )
          `,
          [
            staff.id,
            staff.staff_login,
            getClientIp(request),
            request.headers.get(
              "user-agent"
            ) || null,
          ]
        );
      } catch (error) {
        console.error(
          "verification staff invalid-password activity error:",
          error
        );
      }

      return NextResponse.json(
        { error: "Invalid login details." },
        { status: 401 }
      );
    }

    /*
     * Successful verification-staff login.
     */
    try {
      await db.query(
        `
        INSERT INTO login_activity (
          user_id,
          phone,
          role,
          event_type,
          failure_reason,
          ip_address,
          user_agent
        )
        VALUES (
          $1,
          $2,
          'verification_staff',
          'login_success',
          NULL,
          $3,
          $4
        )
        `,
        [
          staff.id,
          staff.staff_login,
          getClientIp(request),
          request.headers.get(
            "user-agent"
          ) || null,
        ]
      );
    } catch (error) {
      /*
       * Login must remain usable even if activity
       * logging encounters a database issue.
       */
      console.error(
        "verification staff login activity error:",
        error
      );
    }

    const token = createSessionToken(
      staff.id,
      "verification_staff"
    );

    const response = NextResponse.json({
      success: true,
      staff: {
        id: staff.id,
        name: staff.name,
        staffLogin: staff.staff_login,
      },
    });

    response.cookies.set({
      name: VERIFICATION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error(
      "verification-login error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to process staff login.",
      },
      { status: 500 }
    );
  }
}

function getClientIp(request) {
  const forwardedFor =
    request.headers.get(
      "x-forwarded-for"
    ) || "";

  const forwardedIp =
    forwardedFor
      .split(",")[0]
      .trim();

  return (
    forwardedIp ||
    request.headers.get(
      "x-real-ip"
    ) ||
    null
  );
}
