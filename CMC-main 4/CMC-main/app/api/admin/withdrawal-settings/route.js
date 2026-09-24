import { randomUUID } from "crypto";
import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

function adminSession(request) {
  const c = request.headers.get("cookie") || "";
  const m = c.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
  const s = m ? verifySessionToken(m[1]) : null;

  return s && s.role === "admin" ? s : null;
}

export async function GET(request) {
  const s = adminSession(request);

  if (!s) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const settings = (
      await db.query(
        "SELECT * FROM withdrawal_settings WHERE id=TRUE"
      )
    ).rows[0] || {};

    const globalDays = (
      await db.query(
        "SELECT weekday,enabled FROM withdrawal_days ORDER BY weekday"
      )
    ).rows;

    const ranks = (
      await db.query(
        "SELECT id,name FROM ranks ORDER BY display_order,id"
      )
    ).rows;

    const rankDays = (
      await db.query(
        "SELECT rank_id,weekday,enabled FROM rank_withdrawal_days"
      )
    ).rows;

    return Response.json({
      settings,
      globalDays,
      ranks,
      rankDays
    });
  } catch (e) {
    console.error(
      "ADMIN WITHDRAWAL SETTINGS GET ERROR:",
      e
    );

    return Response.json(
      { error: "Unable to load withdrawal settings." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const s = adminSession(request);

  if (!s) {
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

  const enabled = !!body.enabled;

  const unavailableMessage = String(
    body.unavailableMessage ||
      "Withdrawals are currently unavailable."
  )
    .trim()
    .slice(0, 300);

  const feeMode =
    body.feeMode === "fixed"
      ? "fixed"
      : "percentage";

  const feeValue = Number(body.feeValue);
  const minH = Number(body.processingMinHours);
  const maxH = Number(body.processingMaxHours);

  const withdrawalStartTime =
    String(body.withdrawalStartTime || "08:00")
      .trim();
  const withdrawalEndTime =
    String(body.withdrawalEndTime || "17:00")
      .trim();
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (
    !validTime.test(withdrawalStartTime) ||
    !validTime.test(withdrawalEndTime)
  ) {
    return Response.json(
      { error: "Withdrawal times must use HH:MM format." },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(feeValue) ||
    feeValue < 0 ||
    !Number.isFinite(minH) ||
    minH < 0 ||
    !Number.isFinite(maxH) ||
    maxH < minH
  ) {
    return Response.json(
      { error: "Invalid withdrawal settings." },
      { status: 400 }
    );
  }

  const globalDays = Array.isArray(body.globalDays)
    ? body.globalDays
        .map(Number)
        .filter((n) => n >= 0 && n <= 6)
    : [];

  const rankDays = Array.isArray(body.rankDays)
    ? body.rankDays
    : [];

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO withdrawal_settings(
        id,
        enabled,
        unavailable_message,
        fee_mode,
        fee_value,
        processing_min_hours,
        processing_max_hours,
        one_per_24_hours,
        withdrawal_start_time,
        withdrawal_end_time
      )
      VALUES(TRUE,$1,$2,$3,$4,$5,$6,TRUE,$7::time,$8::time)
      ON CONFLICT(id) DO UPDATE SET
        enabled=$1,
        unavailable_message=$2,
        fee_mode=$3,
        fee_value=$4,
        processing_min_hours=$5,
        processing_max_hours=$6,
        one_per_24_hours=TRUE,
        withdrawal_start_time=$7::time,
        withdrawal_end_time=$8::time`,
      [
        enabled,
        unavailableMessage,
        feeMode,
        feeValue,
        minH,
        maxH,
        withdrawalStartTime,
        withdrawalEndTime
      ]
    );

    for (let d = 0; d <= 6; d++) {
      await client.query(
        `INSERT INTO withdrawal_days(
          weekday,
          enabled
        )
        VALUES($1,$2)
        ON CONFLICT(weekday)
        DO UPDATE SET enabled=$2`,
        [
          d,
          globalDays.includes(d)
        ]
      );
    }

    await client.query(
      "DELETE FROM rank_withdrawal_days"
    );

    for (const row of rankDays) {
      const rankId = String(
        row.rankId || ""
      ).trim();

      const days = Array.isArray(row.days)
        ? row.days
            .map(Number)
            .filter((n) => n >= 0 && n <= 6)
        : [];

      if (!rankId) continue;

      for (let d = 0; d <= 6; d++) {
        await client.query(
          `INSERT INTO rank_withdrawal_days(
            rank_id,
            weekday,
            enabled
          )
          VALUES($1,$2,$3)`,
          [
            rankId,
            d,
            days.includes(d)
          ]
        );
      }
    }

    await client.query(
      `INSERT INTO audit_logs(
        id,
        admin_user_id,
        action,
        entity_type,
        new_value,
        reason
      )
      VALUES(
        $1,
        $2,
        'update_withdrawal_settings',
        'withdrawal_settings',
        $3::jsonb,
        'Admin withdrawal configuration update'
      )`,
      [
        randomUUID(),
        s.userId,
        JSON.stringify({
          enabled,
          unavailableMessage,
          feeMode,
          feeValue,
          processingMinHours: minH,
          processingMaxHours: maxH,
          withdrawalStartTime,
          withdrawalEndTime,
          onePer24Hours: true,
          globalDays,
          rankDays
        })
      ]
    );

    await client.query("COMMIT");

    return Response.json({
      ok: true
    });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "ADMIN WITHDRAWAL SETTINGS POST ERROR:",
      e
    );

    return Response.json(
      { error: "Unable to save withdrawal settings." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
