import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

function getAdminSession(request) {
  const cookie = request.headers.get("cookie") || "";

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

/*
  GET
  Load Bonus Draw settings and all stages.
*/
export async function GET(request) {
  const admin = getAdminSession(request);

  if (!admin) {
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
        reward_percentage,
        week_starts_on,
        updated_at
      FROM bonus_draw_settings
      WHERE id = TRUE
      LIMIT 1
    `);

    const stagesResult = await db.query(`
      SELECT
        id,
        stage_number,
        required_deposit,
        active,
        created_at,
        updated_at
      FROM bonus_draw_stages
      ORDER BY stage_number ASC
    `);

    return Response.json({
      settings:
        settingsResult.rows[0] || null,

      stages:
        stagesResult.rows.map(stage => ({
          ...stage,
          required_deposit:
            Number(stage.required_deposit)
        }))
    });

  } catch (error) {
    console.error(
      "Admin Bonus Draw GET error:",
      error
    );

    return Response.json(
      {
        error: "Unable to load Bonus Draw settings."
      },
      { status: 500 }
    );
  }
}

/*
  PUT
  Update Bonus Draw global settings.
*/
export async function PUT(request) {
  const admin = getAdminSession(request);

  if (!admin) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const {
      enabled,
      rewardPercentage,
      weekStartsOn
    } = await request.json();

    const percentage =
      Number(rewardPercentage);

    const weekDay =
      Number(weekStartsOn);

    if (
      !Number.isFinite(percentage) ||
      percentage < 0
    ) {
      throw new Error(
        "Reward percentage must be a valid number."
      );
    }

    if (
      !Number.isInteger(weekDay) ||
      weekDay < 0 ||
      weekDay > 6
    ) {
      throw new Error(
        "Week starting day must be between 0 and 6."
      );
    }

    const db = getDb();

    const result = await db.query(
      `
      UPDATE bonus_draw_settings
      SET
        enabled = $1,
        reward_percentage = $2,
        week_starts_on = $3,
        updated_at = NOW()
      WHERE id = TRUE
      RETURNING
        enabled,
        reward_percentage,
        week_starts_on,
        updated_at
      `,
      [
        Boolean(enabled),
        percentage,
        weekDay
      ]
    );

    return Response.json({
      success: true,
      settings: result.rows[0]
    });

  } catch (error) {
    console.error(
      "Admin Bonus Draw PUT error:",
      error
    );

    return Response.json(
      {
        error: "Unable to save Bonus Draw settings."
      },
      { status: 400 }
    );
  }
}

/*
  POST
  Create a new Bonus Draw stage.
*/
export async function POST(request) {
  const admin = getAdminSession(request);

  if (!admin) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const {
      stageNumber,
      requiredDeposit,
      active = true
    } = await request.json();

    const number =
      Number(stageNumber);

    const deposit =
      Number(requiredDeposit);

    if (
      !Number.isInteger(number) ||
      number < 1
    ) {
      throw new Error(
        "Stage number must be 1 or higher."
      );
    }

    if (
      !Number.isFinite(deposit) ||
      deposit <= 0
    ) {
      throw new Error(
        "Required deposit must be greater than zero."
      );
    }

    const db = getDb();

    const result = await db.query(
      `
      INSERT INTO bonus_draw_stages(
        stage_number,
        required_deposit,
        active
      )
      VALUES(
        $1,
        $2,
        $3
      )
      RETURNING *
      `,
      [
        number,
        deposit,
        Boolean(active)
      ]
    );

    return Response.json({
      success: true,
      stage: {
        ...result.rows[0],
        required_deposit:
          Number(
            result.rows[0].required_deposit
          )
      }
    });

  } catch (error) {
    console.error(
      "Admin Bonus Draw POST error:",
      error
    );

    return Response.json(
      {
        error: "Unable to create Bonus Draw stage."
      },
      { status: 400 }
    );
  }
}

/*
  PATCH
  Update an existing Bonus Draw stage.
*/
export async function PATCH(request) {
  const admin = getAdminSession(request);

  if (!admin) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const {
      stageId,
      stageNumber,
      requiredDeposit,
      active
    } = await request.json();

    if (!stageId) {
      throw new Error(
        "Stage ID is required."
      );
    }

    const number =
      Number(stageNumber);

    const deposit =
      Number(requiredDeposit);

    if (
      !Number.isInteger(number) ||
      number < 1
    ) {
      throw new Error(
        "Stage number must be 1 or higher."
      );
    }

    if (
      !Number.isFinite(deposit) ||
      deposit <= 0
    ) {
      throw new Error(
        "Required deposit must be greater than zero."
      );
    }

    const db = getDb();

    const result = await db.query(
      `
      UPDATE bonus_draw_stages
      SET
        stage_number = $2,
        required_deposit = $3,
        active = $4,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        stageId,
        number,
        deposit,
        Boolean(active)
      ]
    );

    if (!result.rowCount) {
      throw new Error(
        "Bonus Draw stage was not found."
      );
    }

    return Response.json({
      success: true,
      stage: {
        ...result.rows[0],
        required_deposit:
          Number(
            result.rows[0].required_deposit
          )
      }
    });

  } catch (error) {
    console.error(
      "Admin Bonus Draw PATCH error:",
      error
    );

    return Response.json(
      {
        error: "Unable to update Bonus Draw stage."
      },
      { status: 400 }
    );
  }
}

/*
  DELETE
  Delete a Bonus Draw stage.
*/
export async function DELETE(request) {
  const admin = getAdminSession(request);

  if (!admin) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { stageId } =
      await request.json();

    if (!stageId) {
      throw new Error(
        "Stage ID is required."
      );
    }

    const db = getDb();

    await db.query(
      `
      DELETE FROM bonus_draw_stages
      WHERE id = $1
      `,
      [stageId]
    );

    return Response.json({
      success: true
    });

  } catch (error) {
    console.error(
      "Admin Bonus Draw DELETE error:",
      error
    );

    return Response.json(
      {
        error: "Unable to delete Bonus Draw stage."
      },
      { status: 400 }
    );
  }
}
