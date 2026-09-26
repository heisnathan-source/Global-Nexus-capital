import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function adminSession(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session && session.role === "admin"
    ? session
    : null;
}

export async function GET(request) {
  const admin = adminSession(request);

  if (!admin) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const result = await db.query(`
      SELECT
        deposits_enabled,
        withdrawals_enabled,
        bank_deposits_enabled,
        bank_withdrawals_enabled,
        lucky_cards_enabled,
        points_cards_enabled,
        company_activity_enabled,
        updated_at
      FROM admin_platform_settings
      WHERE id = TRUE
      LIMIT 1
    `);

    const withdrawalResult = await db.query(`
      SELECT
        COALESCE(withdrawal_start_time, TIME '08:00:00') AS withdrawal_start_time,
        COALESCE(withdrawal_end_time, TIME '17:00:00') AS withdrawal_end_time
      FROM withdrawal_settings
      WHERE id = TRUE
      LIMIT 1
    `);

    const ranksResult = await db.query(`
      SELECT id, name, rank_number
      FROM ranks
      ORDER BY display_order, id
    `);

    const rankTaskDaysResult = await db.query(`
      SELECT rank_id, weekday, enabled
      FROM rank_task_days
      ORDER BY rank_id, weekday
    `);

    return Response.json({
      settings: result.rows[0] || null,
      withdrawalSchedule: withdrawalResult.rows[0] || {
        withdrawal_start_time: "08:00:00",
        withdrawal_end_time: "17:00:00",
      },
      ranks: ranksResult.rows,
      rankTaskDays: rankTaskDaysResult.rows,
    });
  } catch (error) {
    console.error(
      "Admin settings GET error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load platform settings.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const admin = adminSession(request);

  if (!admin) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const depositsEnabled =
      Boolean(body.depositsEnabled);

    const withdrawalsEnabled =
      Boolean(body.withdrawalsEnabled);

    const bankDepositsEnabled =
      Boolean(body.bankDepositsEnabled);

    const bankWithdrawalsEnabled =
      Boolean(body.bankWithdrawalsEnabled);

    const luckyCardsEnabled =
      Boolean(body.luckyCardsEnabled);

    const pointsCardsEnabled =
      Boolean(body.pointsCardsEnabled);

    const companyActivityEnabled =
      Boolean(body.companyActivityEnabled);

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

    const rankTaskDays =
      Array.isArray(body.rankTaskDays)
        ? body.rankTaskDays
        : null;

    if (rankTaskDays) {
      for (const row of rankTaskDays) {
        if (!row?.rankId) {
          return Response.json(
            { error: "Invalid rank task schedule." },
            { status: 400 }
          );
        }

        const days = Array.isArray(row.days)
          ? row.days.map(Number)
          : [];

        if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
          return Response.json(
            { error: "Rank task days must be between Sunday (0) and Saturday (6)." },
            { status: 400 }
          );
        }
      }
    }

    const db = getDb();

    const result = await db.query(
      `
      UPDATE admin_platform_settings
      SET
        deposits_enabled = $1,
        withdrawals_enabled = $2,
        bank_deposits_enabled = $3,
        bank_withdrawals_enabled = $4,
        lucky_cards_enabled = $5,
        points_cards_enabled = $6,
        company_activity_enabled = $7,
        updated_at = NOW()
      WHERE id = TRUE
      RETURNING
        deposits_enabled,
        withdrawals_enabled,
        bank_deposits_enabled,
        bank_withdrawals_enabled,
        lucky_cards_enabled,
        points_cards_enabled,
        company_activity_enabled,
        updated_at
      `,
      [
        depositsEnabled,
        withdrawalsEnabled,
        bankDepositsEnabled,
        bankWithdrawalsEnabled,
        luckyCardsEnabled,
        pointsCardsEnabled,
        companyActivityEnabled,
      ]
    );

    await db.query(
      `
      INSERT INTO withdrawal_settings(
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
      VALUES(
        TRUE, FALSE, 'Withdrawals are currently unavailable.',
        'percentage', 0, 0, 48, TRUE, $1::time, $2::time
      )
      ON CONFLICT(id) DO UPDATE SET
        withdrawal_start_time = $1::time,
        withdrawal_end_time = $2::time
      `,
      [withdrawalStartTime, withdrawalEndTime]
    );

    if (rankTaskDays) {
      await db.query("DELETE FROM rank_task_days");

      const ranksResult = await db.query(`SELECT id FROM ranks`);
      const validRanks = new Set(
        ranksResult.rows.map((row) => String(row.id))
      );

      for (const row of rankTaskDays) {
        const rankId = String(row.rankId);
        if (!validRanks.has(rankId)) continue;

        const days = Array.isArray(row.days)
          ? [...new Set(row.days.map(Number))]
          : [];

        for (let weekday = 0; weekday <= 6; weekday += 1) {
          await db.query(
            `
            INSERT INTO rank_task_days(rank_id, weekday, enabled)
            VALUES($1, $2, $3)
            ON CONFLICT(rank_id, weekday)
            DO UPDATE SET enabled = EXCLUDED.enabled
            `,
            [rankId, weekday, days.includes(weekday)]
          );
        }
      }
    }

    return Response.json({
      success: true,
      settings: result.rows[0] || null,
      withdrawalSchedule: {
        withdrawal_start_time: withdrawalStartTime,
        withdrawal_end_time: withdrawalEndTime,
      },
    });
  } catch (error) {
    console.error(
      "Admin settings POST error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to save platform settings.",
      },
      { status: 400 }
    );
  }
}
