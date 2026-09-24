import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

function getSession(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session && session.role === "user"
    ? session
    : null;
}

export async function GET(request) {
  const session = getSession(request);

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
          id,
          government_name,
          government_id_number,
          status,
          created_at,
          reviewed_at,
          rejection_reason
        FROM identity_verifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [session.userId]
    );

    return Response.json({
      verification: result.rows[0] || null
    });
  } catch (error) {
    console.error("IDENTITY VERIFICATION GET ERROR:", error);

    return Response.json(
      { error: "Unable to load identity verification." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = getSession(request);

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
      { error: "Invalid request." },
      { status: 400 }
    );
  }

  const governmentName = String(body?.governmentName || "").trim();
  const idNumber = String(body?.idNumber || "").trim();

  if (!governmentName || !idNumber) {
    return Response.json(
      {
        error:
          "Government name and ID number are required."
      },
      { status: 400 }
    );
  }

  if (governmentName.length > 200 || idNumber.length > 100) {
    return Response.json(
      { error: "Verification details are too long." },
      { status: 400 }
    );
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `
        SELECT
          id,
          identity_status,
          withdrawal_enabled
        FROM users
        WHERE id = $1
        FOR UPDATE
      `,
      [session.userId]
    );

    if (!userResult.rowCount) {
      throw new Error("Account not found.");
    }

    const existingResult = await client.query(
      `
        SELECT
          id,
          status
        FROM identity_verifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `,
      [session.userId]
    );

    const existing = existingResult.rows[0];

    if (existing?.status === "approved") {
      await client.query("ROLLBACK");

      return Response.json(
        {
          error:
            "Your identity verification has already been approved."
        },
        { status: 409 }
      );
    }

    let verification;

    if (existing) {
      const result = await client.query(
        `
          UPDATE identity_verifications
          SET
            government_name = $1,
            government_id_number = $2,
            status = 'pending',
            reviewed_by = NULL,
            reviewed_at = NULL,
            rejection_reason = NULL
          WHERE id = $3
          RETURNING
            id,
            government_name,
            government_id_number,
            status,
            created_at,
            reviewed_at,
            rejection_reason
        `,
        [
          governmentName,
          idNumber,
          existing.id
        ]
      );

      verification = result.rows[0];
    } else {
      const result = await client.query(
        `
          INSERT INTO identity_verifications
            (
              user_id,
              government_name,
              government_id_number,
              status
            )
          VALUES
            ($1, $2, $3, 'pending')
          RETURNING
            id,
            government_name,
            government_id_number,
            status,
            created_at,
            reviewed_at,
            rejection_reason
        `,
        [
          session.userId,
          governmentName,
          idNumber
        ]
      );

      verification = result.rows[0];
    }

    await client.query(
      `
        UPDATE users
        SET
          identity_status = 'pending',
          withdrawal_enabled = FALSE
        WHERE id = $1
      `,
      [session.userId]
    );

    await client.query("COMMIT");

    return Response.json(
      {
        ok: true,
        verification
      },
      { status: 201 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "IDENTITY VERIFICATION SUBMIT ERROR:",
      error
    );

    return Response.json(
      { error: "Unable to submit verification." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
