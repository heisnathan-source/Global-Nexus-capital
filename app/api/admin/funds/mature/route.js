import { matureDueFunds } from "@/lib/fund-maturity.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function adminSession(request) {
  const c = request.headers.get("cookie") || "";

  const m = c.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

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
    const matured =
      await matureDueFunds();

    return Response.json({
      processed: matured.length,
      items: matured,
    });
  } catch (error) {
    console.error(
      "Admin fund maturity failed:",
      error
    );

    return Response.json(
      { error: "Unable to process fund maturity." },
      { status: 500 }
    );
  }
}
