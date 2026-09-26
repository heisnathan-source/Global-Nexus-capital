import { getDb } from "@/lib/db.js";

function normalizePhone(phone) {
  return String(phone || "")
    .replace(/\s+/g, "")
    .trim();
}

export async function POST(request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body?.phone);

    if (!phone) {
      return Response.json(
        {
          error: "Phone number is required."
        },
        {
          status: 400
        }
      );
    }

    const db = getDb();

    /*
    Always return the same public success message.
    This prevents someone from using the API to discover
    whether a phone number belongs to a Global Nexus Capital account.
    */

    const publicResponse = {
      ok: true,
      message:
        "If this phone number is registered with Global Nexus Capital, a password recovery request has been submitted for review."
    };

    const userResult = await db.query(
      `
      SELECT id, phone
      FROM users
      WHERE phone = $1
        AND role = 'user'
      LIMIT 1
      `,
      [phone]
    );

    /*
    Unknown phone numbers receive the same public response,
    but no recovery request is created.
    */

    if (!userResult.rowCount) {
      return Response.json(publicResponse);
    }

    const user = userResult.rows[0];

    /*
    Prevent duplicate pending requests.
    */

    const pending = await db.query(
      `
      SELECT id
      FROM password_recovery_requests
      WHERE user_id = $1
        AND status = 'pending'
      LIMIT 1
      `,
      [user.id]
    );

    if (!pending.rowCount) {
      await db.query(
        `
        INSERT INTO password_recovery_requests (
          user_id,
          phone,
          status
        )
        VALUES ($1, $2, 'pending')
        `,
        [user.id, user.phone]
      );
    }

    return Response.json(publicResponse);

  } catch (error) {

    console.error(
      "PASSWORD RECOVERY REQUEST ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to submit your password recovery request."
      },
      {
        status: 500
      }
    );
  }
}
