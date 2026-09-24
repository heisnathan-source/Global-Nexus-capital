import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function admin(r) {
  const c = r.headers.get("cookie") || "";
  const m = c.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );
  const s = m ? verifySessionToken(m[1]) : null;

  return s && s.role === "admin" ? s : null;
}

export async function GET(r) {
  if (!admin(r)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { rows } = await getDb().query(`
      SELECT
        id,
        name,
        description,
        image_url,
        interest_rate,
        period_days,
        min_purchase,
        max_purchase,
        active,
        display_order,
        created_at
      FROM fund_products
      ORDER BY display_order,name
    `);

    return Response.json({
      products: rows,
    });
  } catch (error) {
    console.error(
      "Admin funds GET failed:",
      error
    );

    return Response.json(
      { error: "Unable to load fund products." },
      { status: 500 }
    );
  }
}

export async function POST(r) {
  if (!admin(r)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let b;

  try {
    b = await r.json();
  } catch {
    return Response.json(
      { error: "Invalid request data." },
      { status: 400 }
    );
  }

  try {
    const name =
      String(b.name || "").trim();

    const rate =
      Number(b.interestRate);

    const term =
      Math.trunc(Number(b.termDays));

    const min =
      Number(b.minimumAmount);

    const max =
      b.maximumAmount === "" ||
      b.maximumAmount == null
        ? null
        : Number(b.maximumAmount);

    if (
      !name ||
      ![rate, term, min].every(
        Number.isFinite
      ) ||
      rate < 0 ||
      term < 1 ||
      min < 0 ||
      (
        max !== null &&
        (
          !Number.isFinite(max) ||
          max < min
        )
      )
    ) {
      return Response.json(
        { error: "Invalid fund settings." },
        { status: 400 }
      );
    }

    const q = await getDb().query(
      `
        INSERT INTO fund_products
        (
          name,
          description,
          image_url,
          interest_rate,
          period_days,
          min_purchase,
          max_purchase,
          active,
          display_order
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
      `,
      [
        name,
        String(
          b.description || ""
        ).trim() || null,
        b.imageUrl || null,
        rate,
        term,
        min,
        max,
        b.active !== false,
        Math.trunc(
          Number(b.displayOrder || 0)
        ),
      ]
    );

    return Response.json(
      { product: q.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Admin fund creation failed:",
      error
    );

    return Response.json(
      { error: "Unable to create fund product." },
      { status: 500 }
    );
  }
}
