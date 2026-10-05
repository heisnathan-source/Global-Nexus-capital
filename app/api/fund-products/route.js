import {
  getFundProducts,
  purchaseFund,
} from "@/lib/fund-service.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME,
} from "@/lib/session.js";
import { getDb } from "@/lib/db.js";

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
  try {
    const products = await getFundProducts();

    const sessionData = session(request);

    let purchases = [];

    if (sessionData) {
      const db = getDb();

      const purchasesResult = await db.query(
        `
        SELECT
          fp.id,
          fp.purchase_amount,
          fp.interest_rate,
          fp.expected_return,
          fp.maturity_at,
          fp.status,
          fp.fund_product_id,
          fp.fund_product_id AS product_id,
          f.name AS fund_name,
          f.description AS fund_description,
          f.image_url,
          f.period_days
        FROM fund_purchases fp
        JOIN fund_products f
          ON f.id = fp.fund_product_id
        WHERE fp.user_id = $1
        ORDER BY fp.maturity_at DESC, fp.id DESC
        `,
        [sessionData.userId]
      );

      purchases = purchasesResult.rows;
    }

    return Response.json({
      products,
      purchases,
    });
  } catch (error) {
    console.error(
      "Fund products GET error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load fund products.",
      },
      { status: 500 }
    );
  }
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

  const productId = body?.productId;
  const amount = body?.amount;

  if (!productId) {
    return Response.json(
      { error: "Fund product is required." },
      { status: 400 }
    );
  }

  try {
    const purchase = await purchaseFund(
      sessionData.userId,
      productId,
      amount
    );

    return Response.json(
      { purchase },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Fund purchase API error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to complete the fund purchase.",
      },
      { status: 400 }
    );
  }
}
