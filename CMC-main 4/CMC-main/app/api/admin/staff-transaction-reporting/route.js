import { NextResponse } from "next/server";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
  VERIFICATION_COOKIE_NAME,
} from "@/lib/session.js";
import { getDb } from "@/lib/db.js";

export const dynamic = "force-dynamic";

function getCookie(request, name) {
  const cookieHeader =
    request.headers.get("cookie") || "";

  const parts =
    cookieHeader.split(";");

  for (const part of parts) {
    const trimmed = part.trim();

    if (
      trimmed.startsWith(`${name}=`)
    ) {
      return trimmed.slice(
        name.length + 1
      );
    }
  }

  return null;
}

async function getSession(request) {
  const adminToken =
    getCookie(
      request,
      ADMIN_COOKIE_NAME
    );

  const verificationToken =
    getCookie(
      request,
      VERIFICATION_COOKIE_NAME
    );

  let session = null;

  if (adminToken) {
    session =
      verifySessionToken(
        adminToken
      );
  }

  if (
    !session &&
    verificationToken
  ) {
    session =
      verifySessionToken(
        verificationToken
      );
  }

  if (
    !session ||
    !session.userId
  ) {
    return null;
  }

  if (
    session.role !== "admin" &&
    session.role !==
      "verification_staff"
  ) {
    return null;
  }

  const db = getDb();

  const result =
    await db.query(
      `
        SELECT
          id,
          name,
          role,
          enabled,
          staff_report_exclusion_enabled
        FROM users
        WHERE id = $1
          AND enabled = true
        LIMIT 1
      `,
      [session.userId]
    );

  if (!result.rows[0]) {
    return null;
  }

  return {
    ...result.rows[0],
    userId:
      result.rows[0].id,
  };
}

function cleanText(
  value,
  max = 500
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }

  return text.slice(0, max);
}

export async function POST(
  request
) {
  const session =
    await getSession(request);

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  let body;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid JSON body",
      },
      {
        status: 400,
      }
    );
  }

  const transactionType =
    body.transactionType ===
      "deposit" ||
    body.transactionType ===
      "withdrawal"
      ? body.transactionType
      : null;

  const transactionId =
    cleanText(
      body.transactionId,
      100
    );

  const excluded =
    body.excluded === true;

  const reason =
    cleanText(
      body.reason,
      500
    );

  if (
    !transactionType ||
    !transactionId
  ) {
    return NextResponse.json(
      {
        error:
          "transactionType and transactionId are required",
      },
      {
        status: 400,
      }
    );
  }

  if (
    excluded &&
    !reason
  ) {
    return NextResponse.json(
      {
        error:
          "A reason is required when excluding a transaction",
      },
      {
        status: 400,
      }
    );
  }

  const db = getDb();

  const client =
    await db.connect();

  try {
    await client.query(
      "BEGIN"
    );

    let responsibleStaffId =
      null;

    let transaction =
      null;

    /*
     * Deposit
     */
    if (
      transactionType ===
      "deposit"
    ) {
      const result =
        await client.query(
          `
            SELECT
              id,
              assigned_staff_id,
              amount,
              verified_at
            FROM deposit_orders
            WHERE id = $1
              AND verified_at IS NOT NULL
            FOR UPDATE
          `,
          [transactionId]
        );

      transaction =
        result.rows[0] ||
        null;

      if (!transaction) {
        await client.query(
          "ROLLBACK"
        );

        return NextResponse.json(
          {
            error:
              "Verified deposit transaction was not found",
          },
          {
            status: 404,
          }
        );
      }

      responsibleStaffId =
        transaction.assigned_staff_id;
    }

    /*
     * Withdrawal
     */
    if (
      transactionType ===
      "withdrawal"
    ) {
      const result =
        await client.query(
          `
            SELECT
              id,
              approved_by,
              gross_amount,
              fee_amount,
              net_amount,
              payment_reference,
              payment_sent_at
            FROM withdrawal_orders
            WHERE id = $1
              AND status = 'paid'
            FOR UPDATE
          `,
          [transactionId]
        );

      transaction =
        result.rows[0] ||
        null;

      if (!transaction) {
        await client.query(
          "ROLLBACK"
        );

        return NextResponse.json(
          {
            error:
              "Paid withdrawal transaction was not found",
          },
          {
            status: 404,
          }
        );
      }

      responsibleStaffId =
        transaction.approved_by;
    }

    if (
      !responsibleStaffId
    ) {
      await client.query(
        "ROLLBACK"
      );

      return NextResponse.json(
        {
          error:
            "This transaction has no responsible staff member",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Verification staff can only
     * change their own transactions
     * and only when Main Admin has
     * enabled the permission.
     */
    if (
      session.role ===
      "verification_staff"
    ) {
      if (
        String(
          responsibleStaffId
        ) !==
        String(
          session.userId
        )
      ) {
        await client.query(
          "ROLLBACK"
        );

        return NextResponse.json(
          {
            error:
              "You can only change reporting status for your own transactions",
          },
          {
            status: 403,
          }
        );
      }

      /*
       * Re-read the permission while
       * inside the transaction so the
       * database is authoritative.
       */
      const permissionResult =
        await client.query(
          `
            SELECT
              staff_report_exclusion_enabled
            FROM users
            WHERE id = $1
              AND role = 'verification_staff'
              AND enabled = true
            FOR UPDATE
          `,
          [session.userId]
        );

      const permission =
        permissionResult
          .rows[0];

      if (
        !permission ||
        permission.staff_report_exclusion_enabled !==
          true
      ) {
        await client.query(
          "ROLLBACK"
        );

        return NextResponse.json(
          {
            error:
              "Staff Report Exclusion permission is not enabled for your account",
          },
          {
            status: 403,
          }
        );
      }
    }

    /*
     * Lock the existing reporting
     * record if one exists.
     */
    const existing =
      await client.query(
        `
          SELECT
            id,
            excluded,
            reason,
            changed_by,
            created_at,
            updated_at
          FROM staff_report_exclusions
          WHERE staff_id = $1
            AND transaction_type = $2
            AND transaction_id = $3
          FOR UPDATE
        `,
        [
          responsibleStaffId,
          transactionType,
          transactionId,
        ]
      );

    const previous =
      existing.rows[0] ||
      null;

    const result =
      await client.query(
        `
          INSERT INTO staff_report_exclusions (
            staff_id,
            transaction_type,
            transaction_id,
            excluded,
            reason,
            changed_by,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            NOW(),
            NOW()
          )
          ON CONFLICT (
            staff_id,
            transaction_type,
            transaction_id
          )
          DO UPDATE SET
            excluded =
              EXCLUDED.excluded,
            reason =
              EXCLUDED.reason,
            changed_by =
              EXCLUDED.changed_by,
            updated_at =
              NOW()
          RETURNING
            id,
            staff_id,
            transaction_type,
            transaction_id,
            excluded,
            reason,
            changed_by,
            created_at,
            updated_at
        `,
        [
          responsibleStaffId,
          transactionType,
          transactionId,
          excluded,
          reason,
          session.userId,
        ]
      );

    const updated =
      result.rows[0];

    /*
     * Permanent audit trail.
     */
    await client.query(
      `
        INSERT INTO audit_logs (
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
          $4,
          $5::jsonb,
          $6::jsonb,
          $7,
          NOW()
        )
      `,
      [
        session.userId,

        excluded
          ? "STAFF_TRANSACTION_EXCLUDED"
          : "STAFF_TRANSACTION_INCLUDED",

        `staff_report_${transactionType}`,

        transactionId,

        JSON.stringify({
          excluded:
            previous
              ? previous.excluded
              : false,

          reason:
            previous
              ? previous.reason
              : null,

          changed_by:
            previous
              ? previous.changed_by
              : null,
        }),

        JSON.stringify({
          excluded:
            updated.excluded,

          reason:
            updated.reason,

          changed_by:
            updated.changed_by,

          responsible_staff_id:
            responsibleStaffId,
        }),

        reason,
      ]
    );

    await client.query(
      "COMMIT"
    );

    return NextResponse.json({
      ok: true,

      transactionType,

      transactionId,

      staffId:
        responsibleStaffId,

      excluded:
        updated.excluded,

      included:
        !updated.excluded,

      reason:
        updated.reason,

      changedBy:
        updated.changed_by,

      updatedAt:
        updated.updated_at,
    });
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    console.error(
      "STAFF TRANSACTION REPORTING UPDATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to update staff transaction reporting status",

        details:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      },
      {
        status: 500,
      }
    );
  } finally {
    client.release();
  }
}
