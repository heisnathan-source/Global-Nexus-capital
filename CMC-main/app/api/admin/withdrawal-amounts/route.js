import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

function adminSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  if (!match) return null;

  const session = verifySessionToken(match[1]);

  return session && session.role === "admin"
    ? session
    : null;
}

async function getRanks(db) {
  const { rows } = await db.query(`
    SELECT
      id,
      name,
      rank_number,
      active
    FROM ranks
    WHERE rank_number BETWEEN 1 AND 9
      AND active = TRUE
    ORDER BY rank_number
  `);

  return rows;
}

function normalizeRanks(ranks, validRankNames) {
  if (!Array.isArray(ranks)) {
    return [];
  }

  const valid = new Set(
    validRankNames.map((name) => String(name))
  );

  return [
    ...new Set(
      ranks
        .map((rank) => String(rank || "").trim())
        .filter((rank) => valid.has(rank))
    )
  ];
}

export async function GET(request) {
  if (!adminSession(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const ranks = await getRanks(db);

    const { rows: amounts } = await db.query(`
      SELECT
        wa.id,
        wa.amount,
        wa.active,
        wa.display_order,
        wa.created_at,
        wa.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'rankName', wra.rank_name,
              'active', wra.active
            )
            ORDER BY wra.rank_name
          ) FILTER (WHERE wra.id IS NOT NULL),
          '[]'::json
        ) AS ranks
      FROM withdrawal_amounts wa
      LEFT JOIN withdrawal_amount_rank_assignments wra
        ON wra.withdrawal_amount_id = wa.id
      GROUP BY
        wa.id,
        wa.amount,
        wa.active,
        wa.display_order,
        wa.created_at,
        wa.updated_at
      ORDER BY
        wa.display_order,
        wa.amount
    `);

    return Response.json({
      amounts,
      ranks: ranks.map((rank) => rank.name)
    });
  } catch (error) {
    console.error(
      "WITHDRAWAL AMOUNTS GET ERROR:",
      error
    );

    return Response.json(
      {
        error: "Unable to load withdrawal amounts."
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!adminSession(request)) {
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

  const amount = Number(body?.amount);
  const displayOrder = Number(
    body?.displayOrder ?? 0
  );
  const active = body?.active !== false;
  const requestedRanks = Array.isArray(body?.ranks)
    ? body.ranks
    : [];

  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json(
      {
        error:
          "Withdrawal amount must be greater than 0."
      },
      { status: 400 }
    );
  }

  if (
    !Number.isInteger(displayOrder) ||
    displayOrder < 0
  ) {
    return Response.json(
      {
        error:
          "Display order must be a valid positive number."
      },
      { status: 400 }
    );
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const ranksResult = await client.query(`
      SELECT
        name
      FROM ranks
      WHERE rank_number BETWEEN 1 AND 9
        AND active = TRUE
      ORDER BY rank_number
    `);

    const validRankNames =
      ranksResult.rows.map((row) => row.name);

    const ranks = normalizeRanks(
      requestedRanks,
      validRankNames
    );

    const result = await client.query(
      `
      INSERT INTO withdrawal_amounts
        (amount, active, display_order)
      VALUES
        ($1, $2, $3)
      RETURNING *
      `,
      [
        amount,
        active,
        displayOrder
      ]
    );

    const withdrawalAmount =
      result.rows[0];

    for (const rankName of ranks) {
      await client.query(
        `
        INSERT INTO withdrawal_amount_rank_assignments
          (
            withdrawal_amount_id,
            rank_name,
            active
          )
        VALUES
          ($1, $2, TRUE)
        ON CONFLICT
          (withdrawal_amount_id, rank_name)
        DO UPDATE SET
          active = TRUE,
          updated_at = NOW()
        `,
        [
          withdrawalAmount.id,
          rankName
        ]
      );
    }

    await client.query("COMMIT");

    return Response.json({
      ok: true,
      amount: withdrawalAmount
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "WITHDRAWAL AMOUNTS POST ERROR:",
      error
    );

    if (error?.code === "23505") {
      return Response.json(
        {
          error:
            "That withdrawal amount already exists."
        },
        { status: 409 }
      );
    }

    return Response.json(
      {
        error:
          "Unable to create withdrawal amount."
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function PATCH(request) {
  if (!adminSession(request)) {
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

  const id = String(
    body?.id || ""
  ).trim();

  const amount = Number(body?.amount);

  const displayOrder = Number(
    body?.displayOrder ?? 0
  );

  const active = body?.active !== false;

  const requestedRanks =
    Array.isArray(body?.ranks)
      ? body.ranks
      : [];

  if (!id) {
    return Response.json(
      {
        error:
          "Invalid withdrawal amount ID."
      },
      { status: 400 }
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json(
      {
        error:
          "Withdrawal amount must be greater than 0."
      },
      { status: 400 }
    );
  }

  if (
    !Number.isInteger(displayOrder) ||
    displayOrder < 0
  ) {
    return Response.json(
      {
        error:
          "Display order must be a valid positive number."
      },
      { status: 400 }
    );
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const ranksResult = await client.query(`
      SELECT
        name
      FROM ranks
      WHERE rank_number BETWEEN 1 AND 9
        AND active = TRUE
      ORDER BY rank_number
    `);

    const validRankNames =
      ranksResult.rows.map((row) => row.name);

    const ranks = normalizeRanks(
      requestedRanks,
      validRankNames
    );

    const result = await client.query(
      `
      UPDATE withdrawal_amounts
      SET
        amount = $1,
        active = $2,
        display_order = $3
      WHERE id = $4
      RETURNING *
      `,
      [
        amount,
        active,
        displayOrder,
        id
      ]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");

      return Response.json(
        {
          error:
            "Withdrawal amount not found."
        },
        { status: 404 }
      );
    }

    await client.query(
      `
      UPDATE withdrawal_amount_rank_assignments
      SET
        active = FALSE,
        updated_at = NOW()
      WHERE withdrawal_amount_id = $1
      `,
      [id]
    );

    for (const rankName of ranks) {
      await client.query(
        `
        INSERT INTO withdrawal_amount_rank_assignments
          (
            withdrawal_amount_id,
            rank_name,
            active
          )
        VALUES
          ($1, $2, TRUE)
        ON CONFLICT
          (withdrawal_amount_id, rank_name)
        DO UPDATE SET
          active = TRUE,
          updated_at = NOW()
        `,
        [
          id,
          rankName
        ]
      );
    }

    await client.query("COMMIT");

    return Response.json({
      ok: true,
      amount: result.rows[0]
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "WITHDRAWAL AMOUNTS PATCH ERROR:",
      error
    );

    if (error?.code === "23505") {
      return Response.json(
        {
          error:
            "That withdrawal amount already exists."
        },
        { status: 409 }
      );
    }

    return Response.json(
      {
        error:
          "Unable to update withdrawal amount."
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function DELETE(request) {
  if (!adminSession(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } =
      new URL(request.url);

    const id = String(
      searchParams.get("id") || ""
    ).trim();

    if (!id) {
      return Response.json(
        {
          error:
            "Invalid withdrawal amount ID."
        },
        { status: 400 }
      );
    }

    const db = getDb();

    const result = await db.query(
      `
      DELETE FROM withdrawal_amounts
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (!result.rowCount) {
      return Response.json(
        {
          error:
            "Withdrawal amount not found."
        },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error(
      "WITHDRAWAL AMOUNTS DELETE ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to delete withdrawal amount."
      },
      { status: 500 }
    );
  }
}
