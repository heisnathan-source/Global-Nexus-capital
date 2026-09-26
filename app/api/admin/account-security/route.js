import { getDb } from "@/lib/db.js";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/session.js";

function adminSession(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const s = match ? verifySessionToken(match[1]) : null;

  return s && s.role === "admin" ? s : null;
}

export async function POST(request) {
  const admin = adminSession(request);

  if (!admin) {
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
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const {
    verificationId,
    action,
    rejectionReason
  } = body;

  if (
    !verificationId ||
    !["approve", "reject"].includes(action)
  ) {
    return Response.json(
      {
        error: "Valid verification and action are required."
      },
      { status: 400 }
    );
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const verification = await client.query(
      `
        SELECT
          id,
          user_id,
          status
        FROM identity_verifications
        WHERE id = $1
        FOR UPDATE
      `,
      [verificationId]
    );

    if (!verification.rowCount) {
      throw new Error("Verification not found.");
    }

    const record = verification.rows[0];

    const newStatus =
      action === "approve"
        ? "approved"
        : "rejected";

    const reason =
      action === "reject"
        ? (rejectionReason || "Verification rejected")
        : null;

    /*
     * Update the identity verification record.
     */
    await client.query(
      `
        UPDATE identity_verifications
        SET
          status = $1,
          reviewed_at = NOW(),
          reviewed_by = $2,
          rejection_reason = $3
        WHERE id = $4
      `,
      [
        newStatus,
        admin.userId,
        reason,
        verificationId
      ]
    );

    /*
     * IMPORTANT:
     * Update the actual user's withdrawal identity status.
     *
     * We deliberately update by the user_id we retrieved above,
     * rather than relying on an UPDATE ... FROM statement.
     */
    const userUpdate = await client.query(
      `
        UPDATE users
        SET identity_status = $1
        WHERE id = $2
        RETURNING id, identity_status
      `,
      [
        newStatus,
        record.user_id
      ]
    );

    /*
     * Never silently report success if the user wasn't updated.
     */
    if (!userUpdate.rowCount) {
      throw new Error(
        "Verification was found, but the associated user account could not be updated."
      );
    }

    await client.query(
      `
        INSERT INTO admin_actions
          (
            admin_user_id,
            action_type,
            target_type,
            target_id,
            reason
          )
        VALUES
          ($1, $2, 'identity_verification', $3, $4)
      `,
      [
        admin.userId,
        `identity_${newStatus}`,
        verificationId,
        reason
      ]
    );

    await client.query("COMMIT");

    return Response.json({
      status: newStatus,
      user: userUpdate.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Admin identity verification error:",
      error
    );

    return Response.json(
      {
        error: "Unable to update verification."
      },
      { status: 500 }
    );

  } finally {
    client.release();
  }
}
