import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function getAdminSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  if (!match) return null;

  const session = verifySessionToken(match[1]);

  if (!session || session.role !== "admin") {
    return null;
  }

  return session;
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeLogin(value) {
  return clean(value).replace(/\s+/g, "");
}

export async function GET(request) {
  const admin = getAdminSession(request);

  if (!admin) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 401 }
    );
  }

  const db = getDb();

  try {
    const result = await db.query(`
      SELECT
        id,
        name,
        staff_login,
        enabled,
        staff_report_exclusion_enabled,
        created_at
      FROM users
      WHERE role = 'verification_staff'
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      staff: result.rows,
    });
  } catch (error) {
    console.error(
      "verification-staff GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load verification staff.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const admin = getAdminSession(request);

  if (!admin) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 401 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }

  const name = clean(body.name);
  const staffLogin = normalizeLogin(
    body.staffLogin
  );
  const password = String(
    body.password ?? ""
  );

  if (!name) {
    return NextResponse.json(
      {
        error:
          "Staff name is required.",
      },
      { status: 400 }
    );
  }

  if (!staffLogin) {
    return NextResponse.json(
      {
        error:
          "Staff login number is required.",
      },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      {
        error:
          "Password must contain at least 6 characters.",
      },
      { status: 400 }
    );
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existingStaff =
      await client.query(
        `
        SELECT id
        FROM users
        WHERE staff_login = $1
          AND role = 'verification_staff'
        LIMIT 1
        FOR UPDATE
        `,
        [staffLogin]
      );

    if (existingStaff.rowCount) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "That staff login number is already assigned.",
        },
        { status: 409 }
      );
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const internalPhone =
      `STAFF-${crypto.randomUUID()}`;

    const created = await client.query(
      `
      INSERT INTO users (
        name,
        phone,
        phone_number,
        staff_login,
        login_password_hash,
        registration_date,
        identity_status,
        withdrawal_enabled,
        enabled,
        role,
        staff_report_exclusion_enabled
      )
      VALUES (
        $1,
        $2,
        NULL,
        $3,
        $4,
        NOW(),
        'approved',
        false,
        true,
        'verification_staff',
        false
      )
      RETURNING
        id,
        name,
        staff_login,
        enabled,
        staff_report_exclusion_enabled,
        created_at
      `,
      [
        name,
        internalPhone,
        staffLogin,
        passwordHash,
      ]
    );

    const staff = created.rows[0];

    const auditId =
      crypto.randomUUID();

    await client.query(
      `
      INSERT INTO admin_actions (
        id,
        admin_user_id,
        action_type,
        target_type,
        target_id,
        reason,
        metadata
      )
      VALUES (
        $1,
        $2,
        'create_verification_staff',
        'user',
        $3,
        $4,
        $5
      )
      `,
      [
        auditId,
        admin.userId,
        staff.id,
        "Created verification staff account.",
        JSON.stringify({
          role:
            "verification_staff",
          staff_login:
            staffLogin,
          staff_report_exclusion_enabled:
            false,
        }),
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      staff,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "verification-staff POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to create verification staff account.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function PATCH(request) {
  const admin = getAdminSession(request);

  if (!admin) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 401 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }

  const staffId = clean(
    body.staffId
  );

  if (!staffId) {
    return NextResponse.json(
      {
        error:
          "Staff account ID is required.",
      },
      { status: 400 }
    );
  }

  const hasEnabled =
    typeof body.enabled === "boolean";

  const hasExclusionPermission =
    typeof body.staffReportExclusionEnabled ===
    "boolean";

  if (
    !hasEnabled &&
    !hasExclusionPermission
  ) {
    return NextResponse.json(
      {
        error:
          "No valid staff setting was supplied.",
      },
      { status: 400 }
    );
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing =
      await client.query(
        `
        SELECT
          id,
          name,
          staff_login,
          enabled,
          staff_report_exclusion_enabled
        FROM users
        WHERE id = $1
          AND role = 'verification_staff'
        FOR UPDATE
        `,
        [staffId]
      );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Verification staff account not found.",
        },
        { status: 404 }
      );
    }

    const before =
      existing.rows[0];

    const newEnabled =
      hasEnabled
        ? body.enabled
        : before.enabled;

    const newExclusionPermission =
      hasExclusionPermission
        ? body.staffReportExclusionEnabled
        : before.staff_report_exclusion_enabled;

    const updated =
      await client.query(
        `
        UPDATE users
        SET
          enabled = $1,
          staff_report_exclusion_enabled = $2
        WHERE id = $3
          AND role = 'verification_staff'
        RETURNING
          id,
          name,
          staff_login,
          enabled,
          staff_report_exclusion_enabled,
          created_at
        `,
        [
          newEnabled,
          newExclusionPermission,
          staffId,
        ]
      );

    const staff =
      updated.rows[0];

    const changes = {
      previous_enabled:
        before.enabled,
      new_enabled:
        staff.enabled,
      previous_staff_report_exclusion_enabled:
        before.staff_report_exclusion_enabled,
      new_staff_report_exclusion_enabled:
        staff.staff_report_exclusion_enabled,
    };

    let actionType =
      "update_verification_staff";

    let reason =
      "Updated verification staff account.";

    if (
      hasExclusionPermission
    ) {
      actionType =
        body.staffReportExclusionEnabled
          ? "enable_staff_report_exclusion"
          : "disable_staff_report_exclusion";

      reason =
        body.staffReportExclusionEnabled
          ? "Enabled staff report exclusion permission."
          : "Disabled staff report exclusion permission.";
    } else if (hasEnabled) {
      actionType =
        body.enabled
          ? "enable_verification_staff"
          : "disable_verification_staff";

      reason =
        body.enabled
          ? "Enabled verification staff account."
          : "Disabled verification staff account.";
    }

    const auditId =
      crypto.randomUUID();

    await client.query(
      `
      INSERT INTO admin_actions (
        id,
        admin_user_id,
        action_type,
        target_type,
        target_id,
        reason,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        'user',
        $4,
        $5,
        $6
      )
      `,
      [
        auditId,
        admin.userId,
        actionType,
        staff.id,
        reason,
        JSON.stringify(changes),
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      staff,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "verification-staff PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to update verification staff account.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
