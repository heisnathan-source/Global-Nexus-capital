import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

import {
  getActiveEvents,
  getLuckyCardState,
  drawLuckyCard
} from "@/lib/lucky.js";


function session(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match =
    cookie.match(
      new RegExp(
        `${USER_COOKIE_NAME}=([^;]+)`
      )
    );

  const token =
    match ? match[1] : null;

  const data =
    token
      ? verifySessionToken(token)
      : null;

  return data && data.role === "user"
    ? data
    : null;
}


async function luckyCardsEnabled() {
  const db = getDb();

  const result = await db.query(`
    SELECT lucky_cards_enabled
    FROM admin_platform_settings
    WHERE id = TRUE
    LIMIT 1
  `);

  return (
    result.rows[0]?.lucky_cards_enabled === true
  );
}


function publicLuckyCardError(error) {
  const message = String(error?.message || "");

  const allowed = new Set([
    "Lucky Cards are currently unavailable.",
    "Lucky Card event is unavailable.",
    "Event ID is required."
  ]);

  return allowed.has(message)
    ? message
    : "Lucky Card draw failed.";
}


export async function GET(request) {
  const s = session(request);

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

  try {
    const enabled =
      await luckyCardsEnabled();

    if (!enabled) {
      return Response.json({
        enabled: false,
        events: []
      });
    }

    const events =
      await getActiveEvents(s.userId);

    const { searchParams } =
      new URL(request.url);

    const eventId =
      String(
        searchParams.get("eventId") || ""
      ).trim();

    if (!eventId) {
      return Response.json({
        enabled: true,
        events
      });
    }

    const eventExists =
      events.some(
        (event) =>
          String(event.id) === eventId
      );

    if (!eventExists) {
      return Response.json(
        {
          error:
            "Lucky Card event is unavailable."
        },
        {
          status: 404
        }
      );
    }

    const state =
      await getLuckyCardState(
        s.userId,
        eventId
      );

    return Response.json({
      enabled: true,
      events,
      ...state
    });

  } catch (error) {
    console.error(
      "Lucky Cards GET error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load Lucky Cards."
      },
      {
        status: 500
      }
    );
  }
}


export async function POST(request) {
  const s = session(request);

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

  try {
    const enabled =
      await luckyCardsEnabled();

    if (!enabled) {
      return Response.json(
        {
          error:
            "Lucky Cards are currently unavailable."
        },
        {
          status: 403
        }
      );
    }

    const body =
      await request.json();

    const eventId =
      String(
        body?.eventId || ""
      ).trim();

    if (!eventId) {
      return Response.json(
        {
          error:
            "Event ID is required."
        },
        {
          status: 400
        }
      );
    }

    const events =
      await getActiveEvents(s.userId);

    const eventExists =
      events.some(
        (event) =>
          String(event.id) === eventId
      );

    if (!eventExists) {
      return Response.json(
        {
          error:
            "Lucky Card event is unavailable."
        },
        {
          status: 404
        }
      );
    }

    const result =
      await drawLuckyCard(
        s.userId,
        eventId
      );

    return Response.json({
      success: true,
      draw: result.draw,
      prize: result.prize,
      fulfillment: result.fulfillment,
      availableDraws: result.availableDraws
    });

  } catch (error) {
    console.error(
      "Lucky Cards POST error:",
      error
    );

    return Response.json(
      {
        error:
          publicLuckyCardError(error)
      },
      {
        status: 400
      }
    );
  }
}
