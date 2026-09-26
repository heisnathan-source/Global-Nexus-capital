import bcrypt from "bcryptjs";
import crypto from "crypto";
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

export async function GET(request) {
  const session = getAdminSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const result = await db.query(
      `
      SELECT
        pr.id,
        pr.user_id,
        pr.phone,
        pr.status,
        pr.handled_by,
        pr.handled_at,
        pr.created_at,
        pr.updated_at,

        u.phone AS registered_phone,

        admin.phone AS handled_by_phone

      FROM password_recovery_requests pr

      LEFT JOIN users u
        ON u.id = pr.user_id

      LEFT JOIN users admin
        ON admin.id = pr.handled_by

      ORDER BY
        CASE
          WHEN pr.status = 'pending' THEN 0
          ELSE 1
        END,
        pr.created_at DESC
      `
    );

    return Response.json({
      requests: result.rows
    });

  } catch (error) {
    console.error(
      "ADMIN PASSWORD RECOVERY GET ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load password recovery requests."
      },
      {
        status: 500
      }
    );
  }
}

export async function POST(request) {
  const session = getAdminSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let client;

  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: "Invalid request."
        },
        {
          status: 400
        }
      );
    }

    const requestId =
      String(body?.requestId || "").trim();

    const action =
      String(body?.action || "").trim();

    if (!requestId) {
      return Response.json(
        {
          error: "Request ID is required."
        },
        {
          status: 400
        }
      );
    }

    if (
      action !== "reset" &&
      action !== "cancelled"
    ) {
      return Response.json(
        {
          error:
            "Action must be reset or cancelled."
        },
        {
          status: 400
        }
      );
    }

    const db = getDb();

    client = await db.connect();

    await client.query("BEGIN");

    /*
    ==========================================
    LOCK RECOVERY REQUEST
    ==========================================
    */

    const recoveryResult = await client.query(
      `
      SELECT
        id,
        user_id,
        phone,
        status
      FROM password_recovery_requests
      WHERE id = $1
      FOR UPDATE
      `,
      [requestId]
    );

    if (!recoveryResult.rowCount) {
      throw new Error(
        "Recovery request not found."
      );
    }

    const recovery =
      recoveryResult.rows[0];

    if (recovery.status !== "pending") {
      throw new Error(
        "This recovery request has already been processed."
      );
    }

    /*
    ==========================================
    CANCEL REQUEST
    ==========================================
    */

    if (action === "cancelled") {
      const cancelled =
        await client.query(
          `
          UPDATE password_recovery_requests
          SET
            status = 'cancelled',
            handled_by = $1,
            handled_at = NOW(),
            updated_at = NOW()
          WHERE id = $2
          RETURNING *
          `,
          [
            session.userId,
            requestId
          ]
        );

      await client.query("COMMIT");

      return Response.json({
        ok: true,
        request: cancelled.rows[0]
      });
    }

    /*
    ==========================================
    RESET PASSWORD
    ==========================================
    */

    if (!recovery.user_id) {
      throw new Error(
        "This recovery request is not linked to a user account."
      );
    }

    /*
    Generate a cryptographically secure
    temporary password.
    */

    const temporaryPassword =
      crypto.randomBytes(9).toString("base64url");

    const passwordHash =
      await bcrypt.hash(
        temporaryPassword,
        12
      );

    /*
    Only update an actual user account.
    */

    const userResult =
      await client.query(
        `
        UPDATE users
        SET login_password_hash = $1
        WHERE id = $2
          AND role = 'user'
        RETURNING id, phone
        `,
        [
          passwordHash,
          recovery.user_id
        ]
      );

    if (!userResult.rowCount) {
      throw new Error(
        "The user account could not be found."
      );
    }

    /*
    Mark recovery request handled.
    */

    const handledResult =
      await client.query(
        `
        UPDATE password_recovery_requests
        SET
          status = 'handled',
          handled_by = $1,
          handled_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [
          session.userId,
          requestId
        ]
      );

    if (!handledResult.rowCount) {
      throw new Error(
        "Unable to update the recovery request."
      );
    }

    /*
    ==========================================
    AUDIT LOG
    ==========================================

    IMPORTANT:
    The audit record is part of the same
    database transaction.

    If the audit insert fails, the password
    reset also rolls back.
    */

    await client.query(
      `
      INSERT INTO audit_logs
      (
        id,
        admin_user_id,
        action,
        entity_type,
        entity_id,
        new_value
      )
      VALUES
      (
        $1,
        $2,
        'password_recovery_reset',
        'user',
        $3,
        $4
      )
      `,
      [
        crypto.randomUUID(),
        session.userId,
        recovery.user_id,
        JSON.stringify({
          recovery_request_id: requestId,
          reset: true
        })
      ]
    );

    await client.query("COMMIT");

    return Response.json({
      ok: true,
      temporaryPassword,
      request: handledResult.rows[0]
    });

  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    console.error(
      "ADMIN PASSWORD RECOVERY POST ERROR:",
      error
    );

    const safeErrors = new Set([
      "Recovery request not found.",
      "This recovery request has already been processed.",
      "This recovery request is not linked to a user account.",
      "The user account could not be found.",
      "Unable to update the recovery request."
    ]);

    return Response.json(
      {
        error: safeErrors.has(error?.message)
          ? error.message
          : "Unable to process the password recovery request."
      },
      {
        status: 500
      }
    );

  } finally {
    if (client) {
      client.release();
    }
  }
}
