import { getDb } from "@/lib/db.js";
import {
  getOrCreateReferralCode,
  getTeamSummary,
} from "@/lib/referral-service.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME,
} from "@/lib/session.js";

function session(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const sessionData = match
    ? verifySessionToken(match[1])
    : null;

  return sessionData &&
    sessionData.role === "user"
    ? sessionData
    : null;
}

export async function GET(request) {
  const sessionData = session(request);

  if (!sessionData) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    return Response.json({
      referralCode:
        await getOrCreateReferralCode(
          sessionData.userId
        ),
      team:
        await getTeamSummary(
          sessionData.userId
        ),
    });
  } catch (error) {
    console.error(
      "Team expansion GET error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load team expansion.",
      },
      { status: 500 }
    );
  }
}

/*
 * Direct referral relationships are created only by
 * /api/auth/register using a validated referral code.
 *
 * This endpoint intentionally does not provide a POST
 * operation because allowing an existing user to submit
 * another user's ID could arbitrarily alter the sponsor
 * relationship.
 */
export async function POST() {
  return Response.json(
    {
      error:
        "Direct referral relationships can only be created during registration."
    },
    { status: 410 }
  );
}
