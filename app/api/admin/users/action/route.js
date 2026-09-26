import crypto from "crypto";
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

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session && session.role === "admin"
    ? session
    : null;
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
      { error: "Invalid request data." },
      { status: 400 }
    );
  }

  const userId = String(
    body?.userId || ""
  ).trim();

  const action = String(
    body?.action || ""
  ).trim().toLowerCase();

  if (!userId) {
    return Response.json(
      { error: "User ID is required." },
      { status: 400 }
    );
  }

  if (
    !["suspend", "activate", "remove"].includes(action)
  ) {
    return Response.json(
      { error: "Invalid action." },
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
        role,
        enabled,
        withdrawal_enabled
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
            "Only user accounts can be modified here."
        },
        { status: 400 }
      );
    }

    if (
      session.userId &&
      String(session.userId) === String(user.id)
    ) {
      await client.query("ROLLBACK");

      return Response.json(
        {
          error:
            "You cannot modify your own account."
        },
        { status: 400 }
      );
    }

    let enabled = user.enabled;
    let withdrawalEnabled = user.withdrawal_enabled;

    if (action === "suspend") {
      enabled = false;
    }

    if (action === "activate") {
      enabled = true;
    }

    if (action === "remove") {
      enabled = false;
      withdrawalEnabled = false;
    }

    const updated = await client.query(
      `
      UPDATE users
      SET
        enabled = $2,
        withdrawal_enabled = $3
      WHERE id = $1
        AND role = 'user'
      RETURNING
        id,
        name,
        role,
        enabled,
        withdrawal_enabled
      `,
      [
        userId,
        enabled,
        withdrawalEnabled
      ]
    );

    if (!updated.rowCount) {
      throw new Error("Unable to update user.");
    }

    const actionDescriptions = {
      suspend: "Suspended user account.",
      activate: "Activated user account.",
      remove: "Removed user access and disabled withdrawals."
    };

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
        $3,
        'user',
        $4,
        $5::jsonb,
        $6::jsonb,
        $7,
        NOW()
      )
      `,
      [
        crypto.randomUUID(),
        session.userId,
        `user_${action}`,
        userId,
        JSON.stringify({
          enabled: user.enabled,
          withdrawal_enabled:
            user.withdrawal_enabled
        }),
        JSON.stringify({
          enabled,
          withdrawal_enabled:
            withdrawalEnabled
        }),
        actionDescriptions[action]
      ]
    );

    await client.query("COMMIT");

    let message;

    if (action === "suspend") {
      message = `${user.name} has been suspended.`;
    } else if (action === "activate") {
      message = `${user.name} has been activated.`;
    } else {
      message =
        `${user.name} has been removed and access disabled.`;
    }

    return Response.json({
      ok: true,
      message,
      enabled,
      withdrawal_enabled: withdrawalEnabled
    });

  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    console.error(
      "ADMIN USER ACTION ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to perform the requested user action."
      },
      { status: 500 }
    );

  } finally {
    if (client) {
      client.release();
    }
  }
}
