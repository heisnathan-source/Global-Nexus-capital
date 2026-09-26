import { getDb } from "@/lib/db.js";
import {
  getOrCreateReferralCode,
} from "@/lib/referral-code.js";
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
    const db = getDb();

    const purchase = await db.query(
      `
      SELECT 1
      FROM user_rank_purchases
      WHERE user_id = $1
        AND status IN ('active', 'completed')
      LIMIT 1
      `,
      [sessionData.userId]
    );

    if (!purchase.rowCount) {
      return Response.json(
        {
          locked: true,
          hasRankPurchase: false,
          error:
            "Purchase at least one Global Nexus Capital rank to unlock your referral link and QR code.",
        },
        { status: 403 }
      );
    }

    const code =
      await getOrCreateReferralCode(
        sessionData.userId
      );

    return Response.json({
      locked: false,
      hasRankPurchase: true,
      code,
      link:
        `/register?ref=${encodeURIComponent(code)}`,
    });
  } catch (error) {
    console.error(
      "Referral code API error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load your referral code.",
      },
      { status: 500 }
    );
  }
}
