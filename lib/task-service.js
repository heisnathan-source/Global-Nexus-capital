import { getDb } from "./db.js";
import { isRankTaskDayAllowed } from "./task-schedule.js";

/*
  Global Nexus Capital TASK CYCLE

  Tasks reset every day at 12:00 PM Ghana time.
  Ghana uses UTC, so 12:00 Ghana time = 12:00 UTC.
*/

function getTaskCycleStart() {
  const now = new Date();

  const cycle = new Date(now);

  cycle.setUTCHours(12, 0, 0, 0);

  if (now < cycle) {
    cycle.setUTCDate(
      cycle.getUTCDate() - 1
    );
  }

  return cycle;
}


/*
==================================================
GET USER TASK STATUS FOR CURRENT CYCLE
==================================================
*/

async function getTaskCycleStatus(
  db,
  userId,
  cycleStart
) {
  const result = await db.query(
    `
    SELECT
      COALESCE(
        rpr.division_count,
        1
      ) AS task_limit,

      COUNT(ta.id)
      FILTER (
        WHERE ta.correct = TRUE
      ) AS completed_count

    FROM users u

    LEFT JOIN rank_purchase_rules rpr
      ON rpr.rank_id = u.rank_id

    LEFT JOIN task_attempts ta
      ON ta.user_id = u.id
      AND ta.created_at >= $2

    WHERE u.id = $1

    GROUP BY
      rpr.division_count
    `,
    [userId, cycleStart]
  );

  if (!result.rowCount) {
    return {
      taskLimit: 0,
      completedCount: 0,
      limitReached: true
    };
  }

  const row = result.rows[0];

  const taskLimit =
    Number(row.task_limit || 0);

  const completedCount =
    Number(row.completed_count || 0);

  return {
    taskLimit,
    completedCount,

    limitReached:
      completedCount >= taskLimit
  };
}


/*
==================================================
GET AVAILABLE TASKS
==================================================

Each task has its own display_limit.

Example:

Forex:
display_limit = 3

User attempts:

Display 1 → Wrong
Display 2 → Wrong

Forex is still available for:

Display 3

Wrong answers do NOT affect the
user's overall successful task limit.

Once the user reaches their rank's
maximum number of CORRECT answers,
all remaining tasks are locked.
==================================================
*/

export async function getAvailableTasks(userId) {
  const db = getDb();

  const cycleStart =
    getTaskCycleStart();

  const rankResult = await db.query(
    `
      SELECT rank_id
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  if (!rankResult.rowCount || !rankResult.rows[0].rank_id) {
    return [];
  }

  const taskDayAllowed = await isRankTaskDayAllowed(
    db,
    rankResult.rows[0].rank_id
  );

  if (!taskDayAllowed) {
    return [];
  }


  /*
    Check the user's overall successful
    task limit first.
  */

  const cycleStatus =
    await getTaskCycleStatus(
      db,
      userId,
      cycleStart
    );


  /*
    Rank successful limit reached.

    Everything becomes unavailable
    until the next task cycle.
  */

  if (cycleStatus.limitReached) {
    return [];
  }


  /*
    Return every task that still has
    unused displays.

    The user is free to choose any
    available task.
  */

  const { rows } = await db.query(
    `
    SELECT
      t.id,
      t.title,
      t.image_url,
      t.question,
      t.description,
      t.display_limit,

      ts.description AS set_description,
      ts.commission_per_task
        AS commission_amount,

      r.name AS rank_name,

      COALESCE(
        attempt_data.attempt_count,
        0
      ) AS attempt_count,

      (
        COALESCE(
          attempt_data.attempt_count,
          0
        ) + 1
      ) AS display_number,

      FALSE AS completed,

      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', topt.id,
              'text', topt.option_text
            )
            ORDER BY
              topt.display_order ASC
          )
          FROM task_options topt
          WHERE topt.task_id = t.id
        ),
        '[]'::json
      ) AS options

    FROM tasks t

    JOIN task_sets ts
      ON ts.id = t.task_set_id
      AND ts.active = TRUE

    JOIN users u
      ON u.id = $1

    LEFT JOIN ranks r
      ON r.id = ts.rank_id

    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) AS attempt_count
      FROM task_attempts ta
      WHERE
        ta.task_id = t.id
        AND ta.user_id = $1
        AND ta.created_at >= $2
    ) attempt_data
      ON TRUE

    WHERE
      t.active = TRUE

      AND u.rank_id IS NOT NULL

      AND (
        ts.rank_id IS NULL
        OR ts.rank_id = u.rank_id
      )

      /*
        Only show the task while it still
        has unused displays.
      */

      AND COALESCE(
        attempt_data.attempt_count,
        0
      ) < GREATEST(
        t.display_limit,
        1
      )

    ORDER BY
      t.display_order ASC,
      t.id DESC
    `,
    [userId, cycleStart]
  );

  return rows;
}


/*
==================================================
SUBMIT TASK
==================================================
*/

export async function submitTask(
  userId,
  taskId,
  answer
) {
  const db = getDb();

  const client =
    await db.connect();

  try {

    await client.query("BEGIN");


    const cycleStart =
      getTaskCycleStart();

    /*
    ==============================================
    LOCK USER AND GET RANK LIMIT
    ==============================================
    */

    const userRank =
      await client.query(
        `
        SELECT
          u.rank_id,

          COALESCE(
            rpr.division_count,
            1
          ) AS task_limit

        FROM users u

        LEFT JOIN rank_purchase_rules rpr
          ON rpr.rank_id = u.rank_id

        WHERE u.id = $1

        FOR UPDATE OF u
        `,
        [userId]
      );


    if (!userRank.rowCount) {
      throw new Error(
        "User not found."
      );
    }


    const rankInfo =
      userRank.rows[0];

    if (!rankInfo.rank_id) {
      throw new Error(
        "Purchase a rank before performing tasks."
      );
    }

    const taskDayAllowed = await isRankTaskDayAllowed(
      client,
      rankInfo.rank_id
    );

    if (!taskDayAllowed) {
      throw new Error(
        "Tasks are not available for your rank today."
      );
    }


    const taskLimit =
      Number(
        rankInfo.task_limit || 0
      );


    /*
    ==============================================
    COUNT SUCCESSFUL TASKS
    ==============================================

    Only correct answers count toward
    the user's rank limit.
    */

    const successCountResult =
      await client.query(
        `
        SELECT
          COUNT(*) AS completed_count
        FROM task_attempts
        WHERE
          user_id = $1
          AND correct = TRUE
          AND created_at >= $2
        `,
        [
          userId,
          cycleStart
        ]
      );


    const completedCount =
      Number(
        successCountResult
          .rows[0]
          .completed_count || 0
      );


    /*
      If successful limit is reached,
      lock everything.
    */

    if (completedCount >= taskLimit) {
      throw new Error(
        "You have reached your task limit for the current cycle."
      );
    }


    /*
    ==============================================
    LOAD AND LOCK SELECTED TASK
    ==============================================
    */

    const task =
      await client.query(
        `
        SELECT
          t.*,

          ts.commission_per_task,
          ts.rank_id AS task_rank_id,
          ts.active AS set_active

        FROM tasks t

        JOIN task_sets ts
          ON ts.id = t.task_set_id

        WHERE
          t.id = $1
          AND t.active = TRUE

        FOR UPDATE OF t, ts
        `,
        [taskId]
      );


    if (
      !task.rowCount ||
      !task.rows[0].set_active
    ) {
      throw new Error(
        "Task is unavailable."
      );
    }


    const t =
      task.rows[0];


    /*
    ==============================================
    CHECK TASK RANK
    ==============================================
    */

    if (
      t.task_rank_id &&
      t.task_rank_id !== rankInfo.rank_id
    ) {
      throw new Error(
        "This task is not available for your rank."
      );
    }


    /*
    ==============================================
    GET NUMBER OF DISPLAYS ALREADY USED
    ==============================================
    */

    const attemptCountResult =
      await client.query(
        `
        SELECT
          COUNT(*) AS attempt_count
        FROM task_attempts
        WHERE
          task_id = $1
          AND user_id = $2
          AND created_at >= $3
        `,
        [
          taskId,
          userId,
          cycleStart
        ]
      );


    const attemptCount =
      Number(
        attemptCountResult
          .rows[0]
          .attempt_count || 0
      );


    const displayLimit =
      Math.max(
        Number(t.display_limit || 1),
        1
      );


    /*
      Every task can only be attempted
      up to its own display limit.
    */

    if (
      attemptCount >= displayLimit
    ) {
      throw new Error(
        "You have reached the display limit for this task."
      );
    }


    /*
      The next display number.
    */

    const displayNumber =
      attemptCount + 1;


    /*
    ==============================================
    FIND CORRECT ANSWER
    ==============================================
    */

    const correctOption =
      await client.query(
        `
        SELECT option_text
        FROM task_options
        WHERE
          task_id = $1
          AND is_correct = TRUE
        LIMIT 1
        `,
        [taskId]
      );


    let isCorrect = false;


    if (correctOption.rowCount) {

      isCorrect =
        String(answer ?? "")
          .trim()
          .toLowerCase() ===
        String(
          correctOption.rows[0]
            .option_text ?? ""
        )
          .trim()
          .toLowerCase();

    } else {

      isCorrect =
        String(answer ?? "")
          .trim()
          .toLowerCase() ===
        String(
          t.correct_answer ?? ""
        )
          .trim()
          .toLowerCase();
    }


    /*
    ==============================================
    CALCULATE COMMISSION
    ==============================================

    Commission is paid only for
    a correct answer.
    */

    const commission =
      isCorrect
        ? Number(
            t.commission_per_task || 0
          )
        : 0;


    /*
    ==============================================
    RECORD ATTEMPT
    ==============================================

    Every display creates a separate
    task_attempts record.
    */

    const attempt =
      await client.query(
        `
        INSERT INTO task_attempts
          (
            task_id,
            user_id,
            answer,
            correct,
            commission,
            status,
            display_number
          )
        VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            'completed',
            $6
          )
        RETURNING *
        `,
        [
          taskId,
          userId,
          String(answer ?? ""),
          isCorrect,
          commission,
          displayNumber
        ]
      );


    /*
    ==============================================
    PAY COMMISSION
    ==============================================
    */

    if (
      isCorrect &&
      commission > 0
    ) {

      const wallet =
        await client.query(
          `
          SELECT available_balance
          FROM wallets
          WHERE user_id = $1
          FOR UPDATE
          `,
          [userId]
        );


      if (!wallet.rowCount) {
        throw new Error(
          "Wallet not found."
        );
      }


      const after =
        Number(
          wallet.rows[0]
            .available_balance
        ) + commission;


      await client.query(
        `
        UPDATE wallets
        SET
          available_balance = $1,
          updated_at = NOW()
        WHERE user_id = $2
        `,
        [
          after,
          userId
        ]
      );


      const tx =
        await client.query(
          `
          INSERT INTO transactions
            (
              user_id,
              type,
              amount,
              fee,
              status,
              reference,
              metadata
            )
          VALUES
            (
              $1,
              'task_earning',
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
            commission,
            `TASK-${attempt.rows[0].id}`,
            JSON.stringify({
              taskId,
              attemptId:
                attempt.rows[0].id,
              displayNumber,
              cycleStart
            })
          ]
        );


      await client.query(
        `
        INSERT INTO wallet_ledger
          (
            user_id,
            transaction_id,
            entry_type,
            amount,
            balance_after,
            description
          )
        VALUES
          (
            $1,
            $2,
            'task_earning',
            $3,
            $4,
            $5
          )
        `,
        [
          userId,
          tx.rows[0].id,
          commission,
          after,
          `${t.title} - Display ${displayNumber}`
        ]
      );
    }


    /*
    ==============================================
    CALCULATE FINAL SUCCESS COUNT
    ==============================================
    */

    const finalSuccessCount =
      completedCount +
      (isCorrect ? 1 : 0);


    await client.query("COMMIT");


    return {
      ...attempt.rows[0],

      correct:
        isCorrect,

      displayNumber,

      displayLimit,

      completedCount:
        finalSuccessCount,

      taskLimit,

      limitReached:
        finalSuccessCount >= taskLimit
    };


  } catch (e) {

    try {
      await client.query("ROLLBACK");
    } catch {}

    throw e;

  } finally {

    client.release();

  }
}
