import { getDb } from "./db.js";

export async function getWithdrawalPolicy(
  userId,
  now = new Date()
) {
  const db = getDb();

  const q = await db.query(
    `
      SELECT
        u.id,
        u.rank_id,
        u.identity_status,
        u.enabled,
        u.withdrawal_enabled,

        COALESCE(
          r.name,
          'STARTER'
        ) AS rank_name,

        COALESCE(
          ws.enabled,
          FALSE
        ) AS global_enabled,

        COALESCE(
          ws.unavailable_message,
          'Withdrawals are currently unavailable.'
        ) AS unavailable_message,

        COALESCE(
          ws.one_per_24_hours,
          TRUE
        ) AS one_per_24_hours,

        COALESCE(
          ws.processing_min_hours,
          0
        ) AS processing_min_hours,

        COALESCE(
          ws.processing_max_hours,
          48
        ) AS processing_max_hours,

        COALESCE(
          ws.fee_mode,
          'percentage'
        ) AS fee_mode,

        COALESCE(
          ws.fee_value,
          0
        ) AS fee_value,

        COALESCE(
          ws.withdrawal_start_time,
          TIME '08:00:00'
        ) AS withdrawal_start_time,

        COALESCE(
          ws.withdrawal_end_time,
          TIME '17:00:00'
        ) AS withdrawal_end_time

      FROM users u

      LEFT JOIN ranks r
        ON r.id = u.rank_id

      LEFT JOIN withdrawal_settings ws
        ON ws.id = TRUE

      WHERE u.id = $1
    `,
    [userId]
  );

  if (!q.rowCount) {
    throw new Error("User not found.");
  }

  const u = q.rows[0];

  if (!u.enabled) {
    return {
      allowed: false,
      reason: "Account is not active."
    };
  }

  if (!u.withdrawal_enabled) {
    return {
      allowed: false,
      reason:
        "Withdrawal has not yet been activated for your account."
    };
  }

  if (!u.global_enabled) {
    return {
      allowed: false,
      reason: u.unavailable_message
    };
  }

  if (u.identity_status !== "approved") {
    return {
      allowed: false,
      reason:
        "Account Security verification is required before withdrawal."
    };
  }

  const weekday = now.getUTCDay();

  /*
    Global withdrawal schedule.

    This is the default schedule for all users.
  */
  const globalDay = await db.query(
    `
      SELECT enabled
      FROM withdrawal_days
      WHERE weekday = $1
    `,
    [weekday]
  );

  if (
    !globalDay.rowCount ||
    !globalDay.rows[0].enabled
  ) {
    return {
      allowed: false,
      reason:
        "Withdrawals are not available today."
    };
  }

  /*
    Global withdrawal time window.

    Ghana uses UTC, so the server UTC clock is the
    authoritative clock for the configured Ghana window.
    A window where start === end is treated as 24 hours.
  */
  const currentMinutes =
    now.getUTCHours() * 60 + now.getUTCMinutes();

  const startTime =
    String(u.withdrawal_start_time || "08:00:00").slice(0, 5);
  const endTime =
    String(u.withdrawal_end_time || "17:00:00").slice(0, 5);

  const [startHour, startMinute] =
    startTime.split(":").map(Number);
  const [endHour, endMinute] =
    endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  const withinWithdrawalWindow =
    startMinutes === endMinutes
      ? true
      : startMinutes < endMinutes
        ? currentMinutes >= startMinutes && currentMinutes < endMinutes
        : currentMinutes >= startMinutes || currentMinutes < endMinutes;

  if (!withinWithdrawalWindow) {
    return {
      allowed: false,
      reason: `Withdrawals are available from ${startTime} to ${endTime} Ghana time.`
    };
  }

  /*
    Rank-specific schedules are OPTIONAL.

    If there are no active rank-specific rules
    for this rank, the global schedule remains in
    effect.

    If the admin has configured at least one active
    rank-specific day for this rank, that schedule
    overrides the global schedule.
  */
  if (u.rank_id) {
    const rankSchedule = await db.query(
      `
        SELECT
          weekday,
          enabled
        FROM rank_withdrawal_days
        WHERE rank_id = $1
        ORDER BY weekday
      `,
      [u.rank_id]
    );

    if (rankSchedule.rowCount > 0) {
      const todayRule =
        rankSchedule.rows.find(
          row =>
            Number(row.weekday) === weekday
        );

      if (
        !todayRule ||
        !todayRule.enabled
      ) {
        return {
          allowed: false,
          reason:
            `Withdrawals are not available for ${u.rank_name} today.`
        };
      }
    }
  }

  return {
    allowed: true,

    rankId:
      u.rank_id,

    rankName:
      u.rank_name,

    onePer24Hours:
      u.one_per_24_hours,

    feeMode:
      u.fee_mode,

    feeValue:
      Number(u.fee_value),

    processingMinHours:
      Number(
        u.processing_min_hours
      ),

    processingMaxHours:
      Number(
        u.processing_max_hours
      ),

    withdrawalStartTime: startTime,
    withdrawalEndTime: endTime
  };
}
