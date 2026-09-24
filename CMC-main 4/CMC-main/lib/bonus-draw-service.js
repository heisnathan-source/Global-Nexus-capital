import { getDb } from "./db.js";

function getWeekStart(date = new Date(), weekStartsOn = 1) {
  const d = new Date(date);

  d.setHours(0, 0, 0, 0);

  const day = d.getDay();

  const diff =
    (day - Number(weekStartsOn) + 7) % 7;

  d.setDate(d.getDate() - diff);

  return d.toISOString().slice(0, 10);
}

export async function processBonusDrawForUser(
  userId,
  client = null
) {
  const db = getDb();

  const ownClient = !client;

  if (ownClient) {
    client = await db.connect();
  }

  try {
    if (ownClient) {
      await client.query("BEGIN");
    }

    /*
      Lock the settings row so configuration
      cannot change during processing.
    */
    const settingsResult = await client.query(`
      SELECT *
      FROM bonus_draw_settings
      WHERE id = TRUE
      FOR UPDATE
    `);

    if (!settingsResult.rowCount) {
      throw new Error("Bonus Draw settings not found.");
    }

    const settings = settingsResult.rows[0];

    if (!settings.enabled) {
      if (ownClient) {
        await client.query("COMMIT");
      }

      return {
        enabled: false,
        rewards: []
      };
    }

    const weekStart = getWeekStart(
      new Date(),
      settings.week_starts_on
    );

    /*
      Calculate successful deposits for the
      current Bonus Draw week.
    */
    const depositsResult = await client.query(
      `
      SELECT
        COALESCE(SUM(amount), 0) AS deposit_total
      FROM transactions
      WHERE user_id = $1
        AND type = 'deposit'
        AND status = 'successful'
        AND created_at >= $2::date
        AND created_at < ($2::date + INTERVAL '7 days')
      `,
      [
        userId,
        weekStart
      ]
    );

    const depositTotal = Number(
      depositsResult.rows[0].deposit_total || 0
    );

    /*
      Get all active stages the user has reached.
    */
    const stagesResult = await client.query(`
      SELECT
        id,
        stage_number,
        required_deposit
      FROM bonus_draw_stages
      WHERE active = TRUE
        AND required_deposit <= $1
      ORDER BY stage_number ASC
      FOR UPDATE
    `, [
      depositTotal
    ]);

    const rewards = [];

    for (const stage of stagesResult.rows) {

      /*
        Prevent duplicate rewards for the same
        user, stage and week.
      */
      const existingReward = await client.query(
        `
        SELECT id
        FROM bonus_draw_rewards
        WHERE user_id = $1
          AND stage_id = $2
          AND week_start = $3::date
        LIMIT 1
        `,
        [
          userId,
          stage.id,
          weekStart
        ]
      );

      if (existingReward.rowCount) {
        continue;
      }

      const rewardPercentage = Number(
        settings.reward_percentage
      );

      const rewardAmount =
        Number(stage.required_deposit) *
        rewardPercentage /
        100;

      /*
        Lock the user's wallet.
      */
      const walletResult = await client.query(
        `
        SELECT available_balance
        FROM wallets
        WHERE user_id = $1
        FOR UPDATE
        `,
        [
          userId
        ]
      );

      if (!walletResult.rowCount) {
        throw new Error("User wallet not found.");
      }

      const currentBalance = Number(
        walletResult.rows[0].available_balance
      );

      const balanceAfter =
        currentBalance + rewardAmount;

      /*
        Credit the wallet.
      */
      await client.query(
        `
        UPDATE wallets
        SET
          available_balance = $1,
          updated_at = NOW()
        WHERE user_id = $2
        `,
        [
          balanceAfter,
          userId
        ]
      );

      /*
        Create the reward transaction.
      */
      const transactionResult = await client.query(
        `
        INSERT INTO transactions(
          user_id,
          type,
          amount,
          fee,
          status,
          reference,
          metadata
        )
        VALUES(
          $1,
          'bonus_draw_reward',
          $2,
          0,
          'successful',
          $3,
          $4
        )
        RETURNING id
        `,
        [
          userId,
          rewardAmount,
          `BONUS-${weekStart}-${stage.stage_number}-${userId}`,
          JSON.stringify({
            stageId: stage.id,
            stageNumber: stage.stage_number,
            requiredDeposit: Number(
              stage.required_deposit
            ),
            depositTotal,
            rewardPercentage
          })
        ]
      );

      const transactionId =
        transactionResult.rows[0].id;

      /*
        Add wallet ledger entry.
      */
      await client.query(
        `
        INSERT INTO wallet_ledger(
          user_id,
          transaction_id,
          entry_type,
          amount,
          balance_after,
          description
        )
        VALUES(
          $1,
          $2,
          'bonus_draw_reward',
          $3,
          $4,
          $5
        )
        `,
        [
          userId,
          transactionId,
          rewardAmount,
          balanceAfter,
          `Bonus Draw Stage ${stage.stage_number} reward`
        ]
      );

      /*
        Save the reward record.
      */
      await client.query(
        `
        INSERT INTO bonus_draw_rewards(
          user_id,
          stage_id,
          week_start,
          deposit_total,
          reward_percentage,
          reward_amount,
          transaction_id
        )
        VALUES(
          $1,
          $2,
          $3::date,
          $4,
          $5,
          $6,
          $7
        )
        `,
        [
          userId,
          stage.id,
          weekStart,
          depositTotal,
          rewardPercentage,
          rewardAmount,
          transactionId
        ]
      );

      rewards.push({
        stageNumber:
          stage.stage_number,
        requiredDeposit:
          Number(stage.required_deposit),
        rewardAmount
      });
    }

    if (ownClient) {
      await client.query("COMMIT");
    }

    return {
      enabled: true,
      weekStart,
      depositTotal,
      rewards
    };

  } catch (error) {

    if (ownClient) {
      await client.query("ROLLBACK");
    }

    throw error;

  } finally {

    if (ownClient) {
      client.release();
    }

  }
}
