import crypto from "crypto";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/session.js";
import { postWalletEntry } from "@/lib/wallet-service.js";

const MAX_CASH_GIFT = 1_000_000;

function adminSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session && session.role === "admin"
    ? session
    : null;
}

export async function POST(request) {
  const session = adminSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const userId = String(
      body?.userId || ""
    ).trim();

    const amount = Number(body?.amount);

    const note = String(
      body?.note || ""
    ).trim();

    if (!userId) {
      return Response.json(
        { error: "User is required." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return Response.json(
        {
          error:
            "Please enter a valid cash gift amount."
        },
        { status: 400 }
      );
    }

    if (amount > MAX_CASH_GIFT) {
      return Response.json(
        {
          error:
            `Cash gift cannot exceed GHS ${MAX_CASH_GIFT.toLocaleString()}.`
        },
        { status: 400 }
      );
    }

    const dbImport = await import("@/lib/db.js");
    const db = dbImport.getDb();
    const client = await db.connect();

    try {
      const target = await client.query(
        `
        SELECT
          id,
          role,
          enabled
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
      );

      if (!target.rowCount) {
        return Response.json(
          { error: "User was not found." },
          { status: 404 }
        );
      }

      if (target.rows[0].role !== "user") {
        return Response.json(
          {
            error:
              "Cash gifts can only be sent to user accounts."
          },
          { status: 400 }
        );
      }

      if (!target.rows[0].enabled) {
        return Response.json(
          {
            error:
              "Cash gifts cannot be sent to a disabled user account."
          },
          { status: 400 }
        );
      }
    } finally {
      client.release();
    }

    const description = note
      ? `Cash gift from Global Nexus Capital administration: ${note}`
      : "Cash gift from Global Nexus Capital administration";

    const reference =
      `CMC-GIFT-${Date.now()}-${crypto.randomUUID()}`;

    const result = await postWalletEntry({
      userId,
      type: "admin_cash_gift",
      amount,
      description,
      reference,
      metadata: {
        source: "admin",
        adminCashGift: true,
        adminUserId: session.userId,
        note: note || null
      }
    });

    return Response.json({
      success: true,
      message:
        "Cash gift sent successfully.",
      transactionId:
        result.transactionId,
      balanceAfter:
        result.balanceAfter
    });

  } catch (error) {
    console.error(
      "ADMIN CASH GIFT ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to send cash gift."
      },
      { status: 500 }
    );
  }
}
