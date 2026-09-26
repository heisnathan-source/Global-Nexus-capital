import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

function session(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(
      `${USER_COOKIE_NAME}=([^;]+)`
    )
  );

  const token =
    match ? match[1] : null;

  const data = token
    ? verifySessionToken(token)
    : null;

  return data && data.role === "user"
    ? data
    : null;
}

export async function GET(request) {
  try {

    const user = session(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const db = getDb();

    const result = await db.query(
      `
      SELECT
        lcd.id,
        lcd.draw_number,
        lcd.result AS prize_name,
        lcd.prize_amount,
        lcd.prize_type,
        lcd.fulfillment_status,
        lcd.fulfillment_note,
        lcd.fulfilled_at,
        lcd.created_at,

        e.name AS event_name

      FROM lucky_card_draws lcd

      LEFT JOIN events e
        ON e.id = lcd.event_id

      WHERE lcd.user_id = $1

      ORDER BY lcd.created_at DESC
      `,
      [user.userId]
    );

    return NextResponse.json({
      prizes: result.rows
    });

  } catch (error) {

    console.error(
      "Lucky prize history error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load raffle prize history."
      },
      {
        status: 500
      }
    );
  }
}
