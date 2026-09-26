import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";


function admin(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(
      `${ADMIN_COOKIE_NAME}=([^;]+)`
    )
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session &&
    session.role === "admin"
    ? session
    : null;
}


function cleanOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((option, index) => ({
      text:
        String(option.text || "").trim(),

      isCorrect:
        option.isCorrect === true,

      displayOrder:
        index + 1
    }))
    .filter((option) => option.text);
}


/*
==================================================
GET TASKS
==================================================
*/

export async function GET(request) {
  if (!admin(request)) {
    return Response.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );
  }

  try {
    const db = getDb();

    const { rows } =
      await db.query(
        `
        SELECT
          t.id,
          t.task_set_id,
          t.title,
          t.image_url,
          t.question,
          t.correct_answer,
          t.display_order,
          t.display_limit,
          t.active,
          t.description,
          t.commission_amount,
          t.rank_id,

          ts.name AS set_name,
          ts.description AS set_description,
          ts.rank_id AS set_rank_id,
          ts.commission_per_task,
          ts.active AS set_active,

          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', o.id,
                  'text', o.option_text,
                  'displayOrder', o.display_order,
                  'isCorrect', o.is_correct
                )
                ORDER BY
                  o.display_order ASC
              )
              FROM task_options o
              WHERE o.task_id = t.id
            ),
            '[]'::json
          ) AS options

        FROM tasks t

        LEFT JOIN task_sets ts
          ON ts.id = t.task_set_id

        ORDER BY
          t.display_order ASC,
          t.id DESC
        `
      );

    return Response.json({
      tasks: rows
    });

  } catch (error) {
    console.error(
      "GET TASKS ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load tasks."
      },
      {
        status: 500
      }
    );
  }
}


/*
==================================================
CREATE TASK
==================================================
*/

export async function POST(request) {
  if (!admin(request)) {
    return Response.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );
  }

  const client =
    await getDb().connect();

  try {
    const body =
      await request.json();


    const title =
      String(
        body.title || ""
      ).trim();


    const description =
      String(
        body.description || ""
      ).trim();


    const question =
      String(
        body.question || ""
      ).trim();


    const options =
      cleanOptions(
        body.options
      );


    const imageUrl =
      String(
        body.imageUrl || ""
      ).trim() || null;


    const commission =
      Number(
        body.commission ?? 0
      );


    const rankId =
      body.rankId &&
      String(body.rankId).trim()
        ? body.rankId
        : null;


    const displayOrder =
      Math.trunc(
        Number(
          body.displayOrder ?? 0
        )
      );


    const displayLimit =
      Math.trunc(
        Number(
          body.displayLimit ?? 1
        )
      );


    const active =
      body.active !== false;


    /*
    ==============================================
    VALIDATION
    ==============================================
    */

    if (!title) {
      return Response.json(
        {
          error:
            "Task title is required."
        },
        {
          status: 400
        }
      );
    }


    if (!description) {
      return Response.json(
        {
          error:
            "Task description is required."
        },
        {
          status: 400
        }
      );
    }


    if (!question) {
      return Response.json(
        {
          error:
            "Task question is required."
        },
        {
          status: 400
        }
      );
    }


    if (options.length < 2) {
      return Response.json(
        {
          error:
            "A task must have at least 2 answer choices."
        },
        {
          status: 400
        }
      );
    }


    const correctOptions =
      options.filter(
        (option) =>
          option.isCorrect
      );


    if (
      correctOptions.length !== 1
    ) {
      return Response.json(
        {
          error:
            "Please select exactly one correct answer."
        },
        {
          status: 400
        }
      );
    }


    if (
      !Number.isFinite(
        commission
      ) ||
      commission < 0
    ) {
      return Response.json(
        {
          error:
            "Commission must be a valid amount."
        },
        {
          status: 400
        }
      );
    }


    if (
      !Number.isFinite(
        displayOrder
      )
    ) {
      return Response.json(
        {
          error:
            "Display order must be a valid number."
        },
        {
          status: 400
        }
      );
    }


    if (
      !Number.isInteger(
        displayLimit
      ) ||
      displayLimit < 1
    ) {
      return Response.json(
        {
          error:
            "Display limit must be at least 1."
        },
        {
          status: 400
        }
      );
    }


    const correctAnswer =
      correctOptions[0].text;


    await client.query(
      "BEGIN"
    );


    /*
    ==============================================
    CREATE TASK SET
    ==============================================
    */

    const taskSetResult =
      await client.query(
        `
        INSERT INTO task_sets (
          name,
          description,
          rank_id,
          active,
          commission_per_task
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )
        RETURNING id
        `,
        [
          title,
          description,
          rankId,
          active,
          commission
        ]
      );


    const taskSetId =
      taskSetResult
        .rows[0]
        .id;


    /*
    ==============================================
    CREATE TASK
    ==============================================
    */

    const taskResult =
      await client.query(
        `
        INSERT INTO tasks (
          task_set_id,
          title,
          image_url,
          question,
          correct_answer,
          display_order,
          display_limit,
          active,
          description,
          commission_amount,
          rank_id
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        )
        RETURNING *
        `,
        [
          taskSetId,
          title,
          imageUrl,
          question,
          correctAnswer,
          displayOrder,
          displayLimit,
          active,
          description,
          commission,
          rankId
        ]
      );


    const task =
      taskResult.rows[0];


    /*
    ==============================================
    CREATE ANSWER OPTIONS
    ==============================================
    */

    for (
      const option of options
    ) {
      await client.query(
        `
        INSERT INTO task_options (
          task_id,
          option_text,
          display_order,
          is_correct
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
        `,
        [
          task.id,
          option.text,
          option.displayOrder,
          option.isCorrect
        ]
      );
    }


    await client.query(
      "COMMIT"
    );


    return Response.json(
      {
        ok: true,
        task
      },
      {
        status: 201
      }
    );

  } catch (error) {

    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}


    console.error(
      "CREATE TASK ERROR:",
      error
    );


    return Response.json(
      {
        error: "Unable to create task."
      },
      {
        status: 400
      }
    );

  } finally {
    client.release();
  }
}


/*
==================================================
UPDATE TASK
==================================================
*/

export async function PUT(request) {
  if (!admin(request)) {
    return Response.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );
  }

  const client =
    await getDb().connect();

  try {
    const body =
      await request.json();


    const taskId =
      body.taskId;


    if (!taskId) {
      return Response.json(
        {
          error:
            "Task ID is required."
        },
        {
          status: 400
        }
      );
    }


    const title =
      String(
        body.title || ""
      ).trim();


    const description =
      String(
        body.description || ""
      ).trim();


    const question =
      String(
        body.question || ""
      ).trim();


    const options =
      cleanOptions(
        body.options
      );


    const imageUrl =
      String(
        body.imageUrl || ""
      ).trim() || null;


    const commission =
      Number(
        body.commission ?? 0
      );


    const rankId =
      body.rankId &&
      String(body.rankId).trim()
        ? body.rankId
        : null;


    const displayOrder =
      Math.trunc(
        Number(
          body.displayOrder ?? 0
        )
      );


    const displayLimit =
      Math.trunc(
        Number(
          body.displayLimit ?? 1
        )
      );


    const active =
      body.active !== false;


    /*
    ==============================================
    VALIDATION
    ==============================================
    */

    if (!title) {
      throw new Error(
        "Task title is required."
      );
    }


    if (!description) {
      throw new Error(
        "Task description is required."
      );
    }


    if (!question) {
      throw new Error(
        "Task question is required."
      );
    }


    if (options.length < 2) {
      throw new Error(
        "A task must have at least 2 answer choices."
      );
    }


    const correctOptions =
      options.filter(
        (option) =>
          option.isCorrect
      );


    if (
      correctOptions.length !== 1
    ) {
      throw new Error(
        "Please select exactly one correct answer."
      );
    }


    if (
      !Number.isFinite(
        commission
      ) ||
      commission < 0
    ) {
      throw new Error(
        "Commission must be a valid amount."
      );
    }


    if (
      !Number.isFinite(
        displayOrder
      )
    ) {
      throw new Error(
        "Display order must be a valid number."
      );
    }


    if (
      !Number.isInteger(
        displayLimit
      ) ||
      displayLimit < 1
    ) {
      throw new Error(
        "Display limit must be at least 1."
      );
    }


    const correctAnswer =
      correctOptions[0].text;


    await client.query(
      "BEGIN"
    );


    /*
    ==============================================
    LOCK EXISTING TASK
    ==============================================
    */

    const existing =
      await client.query(
        `
        SELECT
          id,
          task_set_id
        FROM tasks
        WHERE id = $1
        FOR UPDATE
        `,
        [taskId]
      );


    if (!existing.rowCount) {
      throw new Error(
        "Task not found."
      );
    }


    const taskSetId =
      existing.rows[0]
        .task_set_id;


    /*
    ==============================================
    UPDATE TASK SET
    ==============================================
    */

    await client.query(
      `
      UPDATE task_sets
      SET
        name = $2,
        description = $3,
        rank_id = $4,
        active = $5,
        commission_per_task = $6,
        image_url = $7,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        taskSetId,
        title,
        description,
        rankId,
        active,
        commission,
        imageUrl
      ]
    );


    /*
    ==============================================
    UPDATE TASK
    ==============================================
    */

    await client.query(
      `
      UPDATE tasks
      SET
        title = $2,
        image_url = $3,
        question = $4,
        correct_answer = $5,
        display_order = $6,
        display_limit = $7,
        active = $8,
        description = $9,
        commission_amount = $10,
        rank_id = $11
      WHERE id = $1
      `,
      [
        taskId,
        title,
        imageUrl,
        question,
        correctAnswer,
        displayOrder,
        displayLimit,
        active,
        description,
        commission,
        rankId
      ]
    );


    /*
    ==============================================
    REPLACE ANSWER OPTIONS
    ==============================================
    */

    await client.query(
      `
      DELETE FROM task_options
      WHERE task_id = $1
      `,
      [taskId]
    );


    for (
      const option of options
    ) {
      await client.query(
        `
        INSERT INTO task_options (
          task_id,
          option_text,
          display_order,
          is_correct
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
        `,
        [
          taskId,
          option.text,
          option.displayOrder,
          option.isCorrect
        ]
      );
    }


    await client.query(
      "COMMIT"
    );


    return Response.json({
      ok: true
    });

  } catch (error) {

    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}


    console.error(
      "UPDATE TASK ERROR:",
      error
    );


    return Response.json(
      {
        error: "Unable to update task."
      },
      {
        status: 400
      }
    );

  } finally {
    client.release();
  }
}


/*
==================================================
DELETE TASK
==================================================
*/

export async function DELETE(request) {
  if (!admin(request)) {
    return Response.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );
  }


  const client =
    await getDb().connect();


  try {
    const body =
      await request.json();


    const taskId =
      body.taskId;


    if (!taskId) {
      return Response.json(
        {
          error:
            "Task ID is required."
        },
        {
          status: 400
        }
      );
    }


    await client.query(
      "BEGIN"
    );


    const result =
      await client.query(
        `
        SELECT task_set_id
        FROM tasks
        WHERE id = $1
        FOR UPDATE
        `,
        [taskId]
      );


    if (!result.rowCount) {
      throw new Error(
        "Task not found."
      );
    }


    const taskSetId =
      result.rows[0]
        .task_set_id;


    /*
    ==============================================
    DELETE RELATED RECORDS
    ==============================================
    */

    await client.query(
      `
      DELETE FROM task_attempts
      WHERE task_id = $1
      `,
      [taskId]
    );


    await client.query(
      `
      DELETE FROM task_submissions
      WHERE task_id = $1
      `,
      [taskId]
    );


    /*
    task_options uses
    ON DELETE CASCADE
    */

    await client.query(
      `
      DELETE FROM tasks
      WHERE id = $1
      `,
      [taskId]
    );


    /*
    Remove task set if no task
    is using it anymore.
    */

    await client.query(
      `
      DELETE FROM task_sets
      WHERE id = $1
      AND NOT EXISTS (
        SELECT 1
        FROM tasks
        WHERE task_set_id = $1
      )
      `,
      [taskSetId]
    );


    await client.query(
      "COMMIT"
    );


    return Response.json({
      ok: true
    });

  } catch (error) {

    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}


    console.error(
      "DELETE TASK ERROR:",
      error
    );


    return Response.json(
      {
        error: "Unable to delete task."
      },
      {
        status: 400
      }
    );

  } finally {
    client.release();
  }
}
