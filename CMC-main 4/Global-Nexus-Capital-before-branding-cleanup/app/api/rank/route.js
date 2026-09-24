import { getRankCatalog } from "@/lib/rank-service.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME,
} from "@/lib/session.js";

function session(request) {
  const cookieHeader = request.headers.get("cookie") || "";

  const match = cookieHeader.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const sessionData = match
    ? verifySessionToken(match[1])
    : null;

  return sessionData && sessionData.role === "user"
    ? sessionData
    : null;
}

export async function GET(request) {
  const s = session(request);

  if (!s) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    return Response.json({
      ranks: await getRankCatalog(s.userId),
    });
  } catch {
    return Response.json(
      { error: "Unable to load ranks." },
      { status: 500 }
    );
  }
}

export async function POST() {
  return Response.json(
    {
      error:
        "This legacy rank purchase endpoint is disabled. Use the canonical rank purchase endpoint.",
    },
    { status: 410 }
  );
}
