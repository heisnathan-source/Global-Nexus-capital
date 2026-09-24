import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

function getUserSession(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const session =
    match
      ? verifySessionToken(match[1])
      : null;

  return session && session.role === "user"
    ? session
    : null;
}

function getWeekStart(
  date = new Date(),
  weekStartsOn = 1
) {
  const d = new Date(date);

  d.setHours(0, 0, 0, 0);

  const day = d.getDay();

  const diff =
    (day - Number(weekStartsOn) + 7) % 7;

  d.setDate(d.getDate() - diff);

  return d.toISOString().slice(0, 10);
}

export async function GET(request) {
  const session = getUserSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const settingsResult = await db.query(`
      SELECT
        enabled,
        week_starts_on
      FROM bonus_draw_settings
      WHERE id = TRUE
      LIMIT 1
    `);

    if (!settingsResult.rowCount) {
      return Response.json(
        {
          error:
            "Bonus Draw settings not found."
        },
        { status: 500 }
      );
    }

    const settings =
      settingsResult.rows[0];

    const weekStart =
      getWeekStart(
        new Date(),
        settings.week_starts_on
      );

    const depositsResult =
      await db.query(
        `
        SELECT
          COALESCE(SUM(amount), 0) AS total
        FROM transactions
        WHERE user_id = $1
          AND type = 'deposit'
          AND status = 'successful'
          AND created_at >= $2::date
          AND created_at < (
            $2::date + INTERVAL '7 days'
          )
        `,
        [
          session.userId,
          weekStart
        ]
      );

    const depositTotal =
      Number(
        depositsResult.rows[0].total || 0
      );

    const stagesResult =
      await db.query(`
        SELECT
          id,
          stage_number,
          active
        FROM bonus_draw_stages
        WHERE active = TRUE
        ORDER BY stage_number ASC
      `);

    const rewardsResult =
      await db.query(
        `
        SELECT
          stage_id,
          reward_amount,
          created_at
        FROM bonus_draw_rewards
        WHERE user_id = $1
          AND week_start = $2::date
        ORDER BY created_at ASC
        `,
        [
          session.userId,
          weekStart
        ]
      );

    const rewardsByStage =
      new Map(
        rewardsResult.rows.map(
          reward => [
            reward.stage_id,
            reward
          ]
        )
      );

    /*
     * IMPORTANT PRIVACY RULE:
     *
     * Required deposit thresholds and the
     * global reward percentage are private
     * administrative controls.
     *
     * They are intentionally NOT returned
     * to the user-facing API.
     */
    const stages =
      stagesResult.rows.map(
        stage => {
          const reward =
            rewardsByStage.get(
              stage.id
            );

          return {
            id: stage.id,
            stageNumber:
              stage.stage_number,
            reached:
              !!reward,
            rewarded:
              !!reward,
            rewardAmount:
              reward
                ? Number(
                    reward.reward_amount
                  )
                : 0
          };
        }
      );

    /*
     * The next stage number is safe to
     * display, but its private deposit
     * requirement is not returned.
     */
    const nextStage =
      stages.find(
        stage =>
          !stage.reached
      ) || null;

    return Response.json({
      enabled:
        settings.enabled,

      weekStart,

      depositTotal,

      nextStage,

      stages,

      rewards:
        rewardsResult.rows.map(
          reward => ({
            stageId:
              reward.stage_id,

            rewardAmount:
              Number(
                reward.reward_amount
              ),

            createdAt:
              reward.created_at
          })
        )
    });

  } catch (error) {
    console.error(
      "Bonus Draw API error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load Bonus Draw."
      },
      { status: 500 }
    );
  }
}
