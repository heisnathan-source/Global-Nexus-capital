import crypto from "crypto";
import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

const MAX_POINTS_GIFT = 1_000_000;

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
  const session = adminSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } =
      new URL(request.url);

    const search = String(
      searchParams.get("search") || ""
    ).trim();

    const db = getDb();
    const value = `%${search}%`;

    const result = await db.query(
      `
      SELECT
        u.id,
        u.name,
        u.phone,
        u.phone_number,
        u.account_id,

        COALESCE(
          pa.balance,
          0
        ) AS points_balance

      FROM users u

      LEFT JOIN point_accounts pa
        ON pa.user_id = u.id

      WHERE
        u.role = 'user'
        AND u.enabled = TRUE
        AND (
          $1 = '%%'
          OR LOWER(
            COALESCE(u.name, '')
          ) LIKE LOWER($1)
          OR COALESCE(
            u.phone,
            ''
          ) LIKE $1
          OR COALESCE(
            u.phone_number,
            ''
          ) LIKE $1
          OR COALESCE(
            u.account_id,
            ''
          ) LIKE $1
        )

      ORDER BY
        u.created_at DESC

      LIMIT 30
      `,
      [value]
    );

    return Response.json({
      users: result.rows
    });

  } catch (error) {
    console.error(
      "ADMIN POINTS USER SEARCH ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load users."
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = adminSession(request);

  if (!session) {
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
      {
        error:
          "Invalid request data."
      },
      { status: 400 }
    );
  }

  const userId = String(
    body?.userId || ""
  ).trim();

  const points = Math.trunc(
    Number(body?.points)
  );

  const description = String(
    body?.description ||
    "Points gifted by Global Nexus Capital administration."
  ).trim();

  if (!userId) {
    return Response.json(
      {
        error:
          "Please select a user."
      },
      { status: 400 }
    );
  }

  if (
    !Number.isInteger(points) ||
    points <= 0
  ) {
    return Response.json(
      {
        error:
          "Please enter a valid number of points."
      },
      { status: 400 }
    );
  }

  if (points > MAX_POINTS_GIFT) {
    return Response.json(
      {
        error:
          `Points gift cannot exceed ${MAX_POINTS_GIFT.toLocaleString()} points.`
      },
      { status: 400 }
    );
  }

  if (description.length > 500) {
    return Response.json(
      {
        error:
          "The points description is too long."
      },
      { status: 400 }
    );
  }

  let client;

  try {
    const db = getDb();
    client = await db.connect();

    await client.query("BEGIN");

    const userResult = await client.query(
      `
      SELECT
        id,
        name,
        phone,
        account_id,
        role,
        enabled
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (!userResult.rowCount) {
      await client.query("ROLLBACK");

      return Response.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    if (user.role !== "user") {
      await client.query("ROLLBACK");

      return Response.json(
        {
          error:
            "Points can only be gifted to user accounts."
        },
        { status: 400 }
      );
    }

    if (!user.enabled) {
      await client.query("ROLLBACK");

      return Response.json(
        {
          error:
            "Points cannot be gifted to a disabled user account."
        },
        { status: 400 }
      );
    }

    const accountResult =
      await client.query(
        `
        SELECT
          user_id,
          balance
        FROM point_accounts
        WHERE user_id = $1
        FOR UPDATE
        `,
        [userId]
      );

    let newBalance;

    if (accountResult.rowCount) {
      const currentBalance =
        Number(
          accountResult.rows[0].balance || 0
        );

      newBalance =
        currentBalance + points;

      await client.query(
        `
        UPDATE point_accounts
        SET
          balance = $2,
          updated_at = NOW()
        WHERE user_id = $1
        `,
        [
          userId,
          newBalance
        ]
      );

    } else {
      newBalance = points;

      await client.query(
        `
        INSERT INTO point_accounts(
          user_id,
          balance,
          updated_at
        )
        VALUES(
          $1,
          $2,
          NOW()
        )
        `,
        [
          userId,
          newBalance
        ]
      );
    }

    await client.query(
      `
      INSERT INTO point_ledger(
        user_id,
        type,
        points,
        description,
        created_at
      )
      VALUES(
        $1,
        'award',
        $2,
        $3,
        NOW()
      )
      `,
      [
        userId,
        points,
        description
      ]
    );

    await client.query(
      `
      INSERT INTO audit_logs(
        id,
        admin_user_id,
        action,
        entity_type,
        entity_id,
        previous_value,
        new_value,
        reason,
        created_at
      )
      VALUES(
        $1,
        $2,
        'gift_points',
        'user',
        $3,
        $4::jsonb,
        $5::jsonb,
        $6,
        NOW()
      )
      `,
      [
        crypto.randomUUID(),
        session.userId,
        userId,
        JSON.stringify({
          points_balance:
            accountResult.rowCount
              ? Number(
                  accountResult.rows[0]
                    .balance || 0
                )
              : 0
        }),
        JSON.stringify({
          points_balance: newBalance,
          points_gifted: points
        }),
        description
      ]
    );

    await client.query("COMMIT");

    return Response.json({
      ok: true,
      message:
        "Points gifted successfully.",
      user,
      pointsGifted: points,
      newBalance
    });

  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    console.error(
      "ADMIN GIFT POINTS ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to gift points."
      },
      { status: 500 }
    );

  } finally {
    if (client) {
      client.release();
    }
  }
}
