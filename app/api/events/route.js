import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

import {
  getMemberEvents
} from "@/lib/member-event-service.js";


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

    const data =
      await getMemberEvents(s.userId);

    const events =
      Array.isArray(data?.events)
        ? data.events
        : [];


    return Response.json({
      ok: true,
      events: events.map(event => ({

        id: event.id,

        name:
          event.name || "Global Nexus Capital Event",

        description:
          event.description || "",

        banner_url:
          event.banner_url || null,

        start_at:
          event.start_at || null,

        end_at:
          event.end_at || null,

        prizes:
          Array.isArray(event.prizes)
            ? event.prizes.map(prize => ({

                id: prize.id,

                prizeName:
                  prize.prizeName,

                prizeType:
                  prize.prizeType,

                prizeValue:
                  prize.prizeValue,

                claimed:
                  Boolean(prize.claimed),

                claimStatus:
                  prize.claimStatus || null

              }))
            : []

      }))

    });

  } catch (error) {

    console.error(
      "User events GET error:",
      error
    );

    return Response.json(
      {
        ok: false,

        error: "Unable to load events."
      },
      {
        status: 500
      }
    );
  }

}
