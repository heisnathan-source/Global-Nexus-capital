import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session";


function adminSession(request) {
  const c =
    request.headers.get("cookie") || "";

  const m =
    c.match(
      new RegExp(
        `${ADMIN_COOKIE_NAME}=([^;]+)`
      )
    );

  const s =
    m
      ? verifySessionToken(m[1])
      : null;

  return s && s.role === "admin"
    ? s
    : null;
}


/*
==============================================
GET PENDING IDENTITY VERIFICATIONS
==============================================
*/

export async function GET(request) {

  const s =
    adminSession(request);


  if (!s) {

    return Response.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );

  }


  const db =
    getDb();


  const q =
    await db.query(
      `
        SELECT
          iv.id,
          iv.user_id,
          iv.government_name,
          iv.government_id_number,
          iv.status,
          iv.created_at,

          u.name,
          u.phone,
          u.account_id,
          u.identity_status,
          u.withdrawal_enabled

        FROM identity_verifications iv

        JOIN users u
          ON u.id = iv.user_id

        WHERE iv.status = 'pending'

        ORDER BY
          iv.created_at ASC
      `
    );


  return Response.json(
    {
      verifications:
        q.rows
    }
  );

}


/*
==============================================
APPROVE OR REJECT VERIFICATION
==============================================
*/

export async function POST(request) {

  const s =
    adminSession(request);


  if (!s) {

    return Response.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
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
          "Invalid request."
      },
      {
        status: 400
      }
    );

  }


  const {
    id,
    action,
    rejectionReason
  } =
    body;


  if (
    !id ||
    ![
      "approve",
      "reject"
    ].includes(action)
  ) {

    return Response.json(
      {
        error:
          "Invalid verification action."
      },
      {
        status: 400
      }
    );

  }


  if (
    action === "reject" &&
    !String(
      rejectionReason || ""
    ).trim()
  ) {

    return Response.json(
      {
        error:
          "A rejection reason is required."
      },
      {
        status: 400
      }
    );

  }


  const db =
    getDb();


  const client =
    await db.connect();


  try {

    await client.query(
      "BEGIN"
    );


    /*
    ==============================================
    LOCK THE VERIFICATION REQUEST
    ==============================================
    */

    const existing =
      await client.query(
        `
          SELECT
            id,
            user_id,
            status

          FROM identity_verifications

          WHERE id = $1

          FOR UPDATE
        `,
        [id]
      );


    if (!existing.rowCount) {

      throw new Error(
        "Verification request not found."
      );

    }


    const verification =
      existing.rows[0];


    /*
      Prevent reviewing the same request twice.
    */

    if (
      verification.status !==
      "pending"
    ) {

      throw new Error(
        "This verification has already been reviewed."
      );

    }


    const userId =
      verification.user_id;


    /*
    ==============================================
    LOCK USER ACCOUNT
    ==============================================
    */

    const userResult =
      await client.query(
        `
          SELECT
            id,
            name,
            identity_status,
            withdrawal_enabled

          FROM users

          WHERE id = $1

          FOR UPDATE
        `,
        [userId]
      );


    if (!userResult.rowCount) {

      throw new Error(
        "User account not found."
      );

    }


    const user =
      userResult.rows[0];


    /*
    ==============================================
    APPROVE
    ==============================================
    */

    if (
      action === "approve"
    ) {

      /*
        Approve the verification request.
      */

      await client.query(
        `
          UPDATE identity_verifications

          SET
            status = 'approved',
            reviewed_by = $2,
            reviewed_at = NOW(),
            rejection_reason = NULL

          WHERE id = $1
        `,
        [
          id,
          s.userId
        ]
      );


      /*
        Synchronize the users table.

        IMPORTANT:
        Approved verification activates
        withdrawal access for the user.
      */

      await client.query(
        `
          UPDATE users

          SET
            identity_status = 'approved',
            withdrawal_enabled = TRUE

          WHERE id = $1
        `,
        [userId]
      );


      /*
        Record the admin action.
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
              new_value,
              reason
            )

          VALUES
            (
              $1,
              $2,
              'approve_identity_verification',
              'identity_verification',
              $2,
              $3,
              'Identity verification approved'
            )
        `,
        [
          randomUUID(),
          s.userId,
          id,
          JSON.stringify(
            {
              userId,
              identityStatus:
                "approved",

              withdrawalEnabled:
                true
            }
          )
        ]
      );


      await client.query(
        "COMMIT"
      );


      return Response.json(
        {
          ok: true,

          action:
            "approved",

          message:
            `${user.name}'s identity verification has been approved and withdrawals have been activated.`,

          identityStatus:
            "approved",

          withdrawalEnabled:
            true
        }
      );

    }


    /*
    ==============================================
    REJECT
    ==============================================
    */

    const reason =
      String(
        rejectionReason || ""
      )
        .trim()
        .slice(0, 500);


    /*
      Reject the verification request.
    */

    await client.query(
      `
        UPDATE identity_verifications

        SET
          status = 'rejected',
          reviewed_by = $2,
          reviewed_at = NOW(),
          rejection_reason = $3

        WHERE id = $1
      `,
      [
        id,
        s.userId,
        reason
      ]
    );


    /*
      Synchronize the users table.

      IMPORTANT:
      Rejected verification disables
      withdrawal access.
    */

    await client.query(
      `
        UPDATE users

        SET
          identity_status = 'rejected',
          withdrawal_enabled = FALSE

        WHERE id = $1
      `,
      [userId]
    );


    /*
      Record the admin action.
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
            new_value,
            reason
          )

        VALUES
          (
            $1,
            $2,
            'reject_identity_verification',
            'identity_verification',
            $2,
            $3,
            $4
          )
      `,
      [
        randomUUID(),
        s.userId,
        id,
        JSON.stringify(
          {
            userId,

            identityStatus:
              "rejected",

            withdrawalEnabled:
              false
          }
        ),
        reason
      ]
    );


    await client.query(
      "COMMIT"
    );


    return Response.json(
      {
        ok: true,

        action:
          "rejected",

        message:
          `${user.name}'s identity verification has been rejected and withdrawals have been disabled.`,

        identityStatus:
          "rejected",

        withdrawalEnabled:
          false
      }
    );


  } catch (error) {

    try {

      await client.query(
        "ROLLBACK"
      );

    } catch {}


    console.error(
      "IDENTITY VERIFICATION ERROR:",
      error
    );


    return Response.json(
      {
        error: "Unable to process verification."
      },
      {
        status: 400
      }
    );


  } finally {

    client.release();

  }

}
