import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function admin(request) {
  const c = request.headers.get("cookie") || "";

  const m = c.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const s = m ? verifySessionToken(m[1]) : null;

  return s && s.role === "admin" ? s : null;
}

export async function GET(request) {
  if (!admin(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const r = await db.query(`
      SELECT
        id,
        amount,
        active,
        sort_order
      FROM deposit_amount_options
      ORDER BY sort_order ASC, amount ASC
    `);

    return Response.json({
      amounts: r.rows,
    });
  } catch (error) {
    console.error(
      "Admin deposit amounts GET failed:",
      error
    );

    return Response.json(
      { error: "Unable to load deposit amounts." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = admin(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let b;

  try {
    b = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request data." },
      { status: 400 }
    );
  }

  const amount = Number(b.amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return Response.json(
      {
        error:
          "Valid positive amount required.",
      },
      { status: 400 }
    );
  }

  try {
    const db = getDb();

    const r = await db.query(
      `
        INSERT INTO deposit_amount_options
        (
          amount,
          sort_order,
          active
        )
        VALUES
        ($1,$2,TRUE)
        ON CONFLICT(amount)
        DO UPDATE SET
          active=TRUE,
          updated_at=NOW()
        RETURNING *
      `,
      [
        amount,
        Number(b.sortOrder) || 0,
      ]
    );

    return Response.json(
      { amount: r.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Admin deposit amount creation failed:",
      error
    );

    return Response.json(
      { error: "Unable to save deposit amount." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const session = admin(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let b;

  try {
    b = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request data." },
      { status: 400 }
    );
  }

  if (!b.id) {
    return Response.json(
      { error: "Amount id required." },
      { status: 400 }
    );
  }

  try {
    const db = getDb();

    const r = await db.query(
      `
        UPDATE deposit_amount_options
        SET
          active=COALESCE($2,active),
          sort_order=COALESCE($3,sort_order),
          amount=COALESCE($4,amount),
          updated_at=NOW()
        WHERE id=$1
        RETURNING *
      `,
      [
        b.id,
        b.active === undefined
          ? null
          : Boolean(b.active),
        b.sortOrder === undefined
          ? null
          : Number(b.sortOrder),
        b.amount === undefined
          ? null
          : Number(b.amount),
      ]
    );

    if (!r.rowCount) {
      return Response.json(
        { error: "Amount not found." },
        { status: 404 }
      );
    }

    return Response.json({
      amount: r.rows[0],
    });
  } catch (error) {
    console.error(
      "Admin deposit amount update failed:",
      error
    );

    return Response.json(
      { error: "Unable to update deposit amount." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const session = admin(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const id =
    new URL(request.url)
      .searchParams
      .get("id");

  if (!id) {
    return Response.json(
      { error: "Amount id required." },
      { status: 400 }
    );
  }

  try {
    const db = getDb();

    const result = await db.query(
      `
        UPDATE deposit_amount_options
        SET
          active=FALSE,
          updated_at=NOW()
        WHERE id=$1
        RETURNING id
      `,
      [id]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Amount not found." },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Admin deposit amount deletion failed:",
      error
    );

    return Response.json(
      { error: "Unable to disable deposit amount." },
      { status: 500 }
    );
  }
}
