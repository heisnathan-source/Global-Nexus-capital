import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

function admin(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const token = match ? match[1] : null;

  const session = token
    ? verifySessionToken(token)
    : null;

  return session && session.role === "admin"
    ? session
    : null;
}

export async function GET(request) {
  const adminSession = admin(request);

  if (!adminSession) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const result = await db.query(`
      SELECT
        lcd.id,
        lcd.user_id,
        lcd.event_id,
        lcd.rule_id,
        lcd.draw_number,
        lcd.result AS prize_name,
        lcd.prize_amount,
        lcd.prize_type,
        lcd.fulfillment_status,
        lcd.fulfillment_note,
        lcd.fulfilled_at,
        lcd.created_at,

        u.name AS user_name,
        u.phone AS user_phone,
        u.account_id,

        e.name AS event_name

      FROM lucky_card_draws lcd

      LEFT JOIN users u
        ON u.id = lcd.user_id

      LEFT JOIN events e
        ON e.id = lcd.event_id

      ORDER BY lcd.created_at DESC
    `);

    return Response.json({
      prizes: result.rows
    });

  } catch (error) {
    console.error(
      "Admin lucky prize records error:",
      error
    );

    return Response.json(
      {
        error: "Unable to load Lucky Prize records."
      },
      {
        status: 500 }
    );
  }
}

export async function PATCH(request) {
  const adminSession = admin(request);

  if (!adminSession) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const {
      id,
      fulfillmentStatus,
      fulfillmentNote
    } = body;

    if (!id) {
      return Response.json(
        {
          error: "Prize record ID is required."
        },
        {
          status: 400
        }
      );
    }

    const allowedStatuses = [
      "pending",
      "contacted",
      "fulfilled",
      "credited"
    ];

    if (
      fulfillmentStatus &&
      !allowedStatuses.includes(fulfillmentStatus)
    ) {
      return Response.json(
        {
          error: "Invalid fulfillment status."
        },
        {
          status: 400
        }
      );
    }

    const db = getDb();

    const result = await db.query(
      `
      UPDATE lucky_card_draws
      SET
        fulfillment_status = COALESCE(
          $2,
          fulfillment_status
        ),

        fulfillment_note = COALESCE(
          $3,
          fulfillment_note
        ),

        fulfilled_at = CASE
          WHEN $2 = 'fulfilled'
          THEN NOW()
          ELSE fulfilled_at
        END

      WHERE id = $1

      RETURNING *
      `,
      [
        id,
        fulfillmentStatus || null,
        fulfillmentNote ?? null
      ]
    );

    if (!result.rowCount) {
      return Response.json(
        {
          error: "Prize record not found."
        },
        {
          status: 404
        }
      );
    }

    return Response.json({
      message:
        "Prize record updated successfully.",
      prize:
        result.rows[0]
    });

  } catch (error) {
    console.error(
      "Admin lucky prize update error:",
      error
    );

    return Response.json(
      {
        error: "Unable to update Lucky Prize record."
      },
      {
        status: 500
      }
    );
  }
}
