import crypto from "crypto";
import { getDb } from "@/lib/db.js";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  verifySessionToken
} from "@/lib/session.js";

async function requireAdmin() {
  const cookieStore = await cookies();

  const token =
    cookieStore.get(
      ADMIN_COOKIE_NAME
    )?.value;

  const session =
    verifySessionToken(token);

  if (
    !session ||
    session.role !== "admin"
  ) {
    return null;
  }

  return session;
}

export async function GET() {
  try {
    const admin =
      await requireAdmin();

    if (!admin) {
      return Response.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const db = getDb();

    const result =
      await db.query(
        `
        SELECT
          id,
          name,
          phone,
          account_id,

          COALESCE(
            withdrawal_frequency_exempt,
            FALSE
          ) AS withdrawal_frequency_exempt

        FROM users

        WHERE role = 'user'

        ORDER BY
          COALESCE(
            withdrawal_frequency_exempt,
            FALSE
          ) DESC,

          name ASC
        `
      );

    return Response.json({
      ok: true,
      users: result.rows
    });

  } catch (error) {
    console.error(
      "WITHDRAWAL FREQUENCY USERS GET ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Failed to load users."
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const admin =
    await requireAdmin();

  if (!admin) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  let body;

  try {
    body =
      await request.json();
  } catch {
    return Response.json(
      {
        error:
          "Invalid request data."
      },
      { status: 400 }
    );
  }

  const userId =
    String(
      body?.userId || ""
    ).trim();

  const exempt =
    body?.exempt === true;

  if (!userId) {
    return Response.json(
      {
        error:
          "User ID is required."
      },
      { status: 400 }
    );
  }

  let client;

  try {
    const db = getDb();

    client =
      await db.connect();

    await client.query(
      "BEGIN"
    );

    const locked =
      await client.query(
        `
        SELECT
          id,
          name,
          phone,
          account_id,

          COALESCE(
            withdrawal_frequency_exempt,
            FALSE
          ) AS withdrawal_frequency_exempt

        FROM users

        WHERE
          id = $1
          AND role = 'user'

        FOR UPDATE
        `,
        [userId]
      );

    if (!locked.rowCount) {
      await client.query(
        "ROLLBACK"
      );

      return Response.json(
        {
          error:
            "User not found."
        },
        { status: 404 }
      );
    }

    const previous =
      locked.rows[0];

    const updated =
      await client.query(
        `
        UPDATE users

        SET
          withdrawal_frequency_exempt =
            $2

        WHERE
          id = $1
          AND role = 'user'

        RETURNING
          id,
          name,
          phone,
          account_id,

          COALESCE(
            withdrawal_frequency_exempt,
            FALSE
          ) AS withdrawal_frequency_exempt
        `,
        [
          userId,
          exempt
        ]
      );

    if (!updated.rowCount) {
      throw new Error(
        "Unable to update withdrawal permission."
      );
    }

    await client.query(
      `
      INSERT INTO audit_logs (
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
      VALUES (
        $1,
        $2,
        'update_multiple_withdrawals_permission',
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
        admin.userId,
        userId,

        JSON.stringify({
          withdrawal_frequency_exempt:
            previous.withdrawal_frequency_exempt
        }),

        JSON.stringify({
          withdrawal_frequency_exempt:
            updated.rows[0]
              .withdrawal_frequency_exempt
        }),

        "Updated withdrawal frequency exemption permission."
      ]
    );

    await client.query(
      "COMMIT"
    );

    return Response.json({
      ok: true,
      user:
        updated.rows[0]
    });

  } catch (error) {
    if (client) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}
    }

    console.error(
      "WITHDRAWAL FREQUENCY USERS POST ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Failed to update withdrawal frequency permission."
      },
      { status: 500 }
    );

  } finally {
    if (client) {
      client.release();
    }
  }
}
