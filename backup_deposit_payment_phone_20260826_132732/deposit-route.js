import {
  createDepositOrder,
  submitDepositPayment
} from "@/lib/deposit-service.js";

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

  const token = match ? match[1] : null;

  const data = token
    ? verifySessionToken(token)
    : null;

  return data && data.role === "user"
    ? data
    : null;
}

export async function POST(request) {
  const s = session(request);

  if (!s) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    if (body?.action === "submit") {
      const order =
        await submitDepositPayment(
          s.userId,
          body.orderId
        );

      return Response.json({
        order
      });
    }

    const amount = body?.amount;

    const result =
      await createDepositOrder(
        s.userId,
        amount
      );

    return Response.json(
      result,
      { status: 201 }
    );
  } catch (e) {
    console.error(
      "POST /api/deposit error:",
      e
    );

    return Response.json(
      {
        error:
          e?.message ||
          "Unable to process deposit."
      },
      { status: 400 }
    );
  }
}

export async function GET(request) {
  const s = session(request);

  if (!s) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(
    request.url
  );

  const orderId =
    url.searchParams.get("orderId");

  if (!orderId) {
    return Response.json(
      {
        error:
          "Order id required."
      },
      { status: 400 }
    );
  }

  try {
    const {
      getDb
    } = await import(
      "@/lib/db.js"
    );

    const db = getDb();

    const result = await db.query(
      `
      SELECT
        d.id,
        d.amount,
        d.status,
        d.created_at,
        d.payment_submitted_at,
        d.verified_at,
        d.network_id,
        d.wallet_id,
        p.account_number,
        p.recipient_name,
        pn.name AS payment_network
      FROM deposit_orders d
      LEFT JOIN payment_wallet_pool p
        ON p.id = d.wallet_id
      LEFT JOIN payment_networks pn
        ON pn.id = d.network_id
      WHERE d.id = $1
        AND d.user_id = $2
      LIMIT 1
      `,
      [orderId, s.userId]
    );

    if (!result.rowCount) {
      return Response.json(
        {
          error:
            "Deposit order not found."
        },
        { status: 404 }
      );
    }

    return Response.json({
      order: result.rows[0]
    });
  } catch (e) {
    console.error(
      "GET /api/deposit error:",
      e
    );

    return Response.json(
      {
        error:
          "Unable to check deposit status."
      },
      { status: 500 }
    );
  }
}
