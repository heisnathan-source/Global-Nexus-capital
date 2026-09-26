import { creditDailyRankEarnings } from "@/lib/rank-earnings.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function adminSession(request) {
  const c = request.headers.get("cookie") || "";
  const m = c.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
  const s = m ? verifySessionToken(m[1]) : null;

  return s && s.role === "admin" ? s : null;
}

export async function POST(request) {
  const s = adminSession(request);

  if (!s) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const items = await creditDailyRankEarnings(
      new Date().toISOString().slice(0, 10)
    );

    return Response.json({
      processed: items.length,
      items,
    });
  } catch (e) {
    console.error(
      "Admin daily rank earnings failed:",
      e
    );

    return Response.json(
      { error: "Unable to process daily rank earnings." },
      { status: 500 }
    );
  }
}
