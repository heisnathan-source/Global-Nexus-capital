import { purchaseRank } from "@/lib/rank-service.js";
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

function publicPurchaseError(error) {
  const message =
    error instanceof Error
      ? error.message
      : "";

  const safeMessages = new Set([
    "Rank is required.",
    "Rank not found or purchase settings are not configured.",
    "You have already purchased this rank.",
    "You cannot purchase this rank yet.",
    "Insufficient wallet balance.",
  ]);

  if (safeMessages.has(message)) {
    return message;
  }

  if (
    message.includes(
      "higher rank"
    )
  ) {
    return message;
  }

  if (
    message.includes(
      "already purchased"
    )
  ) {
    return message;
  }

  return "Unable to complete the rank purchase.";
}

export async function POST(request) {
  const sessionData = session(request);

  if (!sessionData) {
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

  const rankId = body?.rankId;

  if (!rankId) {
    return Response.json(
      { error: "Rank is required." },
      { status: 400 }
    );
  }

  try {
    const result = await purchaseRank(
      sessionData.userId,
      rankId
    );

    return Response.json(
      result,
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Rank purchase API error:",
      error
    );

    return Response.json(
      {
        error:
          publicPurchaseError(error),
      },
      { status: 400 }
    );
  }
}
