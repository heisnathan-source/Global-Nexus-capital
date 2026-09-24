export const TASK_DAYS = [0, 1, 2, 3, 4, 5, 6];

export async function isRankTaskDayAllowed(db, rankId, now = new Date()) {
  if (!rankId) return false;

  const result = await db.query(
    `
      SELECT weekday, enabled
      FROM rank_task_days
      WHERE rank_id = $1
      ORDER BY weekday
    `,
    [rankId]
  );

  // No rows means the admin has never configured a schedule for this rank.
  // Preserve the existing behaviour and allow tasks every day until configured.
  if (!result.rowCount) return true;

  const weekday = now.getUTCDay();
  return result.rows.some(
    (row) => Number(row.weekday) === weekday && row.enabled === true
  );
}

export async function getRankTaskSchedule(db, rankId) {
  const result = await db.query(
    `
      SELECT weekday, enabled
      FROM rank_task_days
      WHERE rank_id = $1
      ORDER BY weekday
    `,
    [rankId]
  );

  if (!result.rowCount) {
    return { configured: false, days: [...TASK_DAYS] };
  }

  return {
    configured: true,
    days: result.rows
      .filter((row) => row.enabled)
      .map((row) => Number(row.weekday))
  };
}
