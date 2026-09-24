import { getDb } from "@/lib/db.js";
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

export async function GET(request) {
  if (!adminSession(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const { rows } = await db.query(
      `SELECT
        r.id,
        r.name,
        r.rank_number,
        r.active,
        COALESCE(rr.purchase_price,0) purchase_price,
        COALESCE(rr.daily_earning,0) daily_earning,
        COALESCE(rr.division_count,1) division_count,
        COALESCE(rr.color_hex,'') color_hex,
        COALESCE(rr.banner_url,'') banner_url
      FROM ranks r
      LEFT JOIN rank_purchase_rules rr
        ON rr.rank_id=r.id
      WHERE r.rank_number BETWEEN 1 AND 9
      ORDER BY r.rank_number`
    );

    return Response.json({ ranks: rows });
  } catch (e) {
    console.error("Admin ranks GET failed:", e);

    return Response.json(
      { error: "Unable to load rank settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  if (!adminSession(request)) {
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

  try {
    const rankId = String(b.rankId || "");
    const purchasePrice = Number(b.purchasePrice);
    const dailyEarning = Number(b.dailyEarning);
    const divisionCount = Math.trunc(
      Number(b.divisionCount)
    );
    const color = String(b.colorHex || "").trim();

    if (
      !rankId ||
      !Number.isFinite(purchasePrice) ||
      purchasePrice < 0 ||
      !Number.isFinite(dailyEarning) ||
      dailyEarning < 0 ||
      !Number.isInteger(divisionCount) ||
      divisionCount < 1
    ) {
      return Response.json(
        { error: "Invalid rank settings." },
        { status: 400 }
      );
    }

    if (
      color &&
      !/^#[0-9a-fA-F]{6}$/.test(color)
    ) {
      return Response.json(
        {
          error:
            "Rank colour must be a 6-digit hex colour.",
        },
        { status: 400 }
      );
    }

    const db = getDb();

    const r = await db.query(
      `SELECT id
       FROM ranks
       WHERE id=$1
         AND rank_number BETWEEN 1 AND 9`,
      [rankId]
    );

    if (!r.rowCount) {
      return Response.json(
        { error: "Rank not found." },
        { status: 404 }
      );
    }

    await db.query(
      `INSERT INTO rank_purchase_rules(
        rank_id,
        purchase_price,
        daily_earning,
        division_count,
        color_hex
      )
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(rank_id)
      DO UPDATE SET
        purchase_price=EXCLUDED.purchase_price,
        daily_earning=EXCLUDED.daily_earning,
        division_count=EXCLUDED.division_count,
        color_hex=EXCLUDED.color_hex`,
      [
        rankId,
        purchasePrice,
        dailyEarning,
        divisionCount,
        color || null,
      ]
    );

    return Response.json({ ok: true });
  } catch (e) {
    console.error("Admin rank update failed:", e);

    return Response.json(
      { error: "Unable to save rank settings." },
      { status: 500 }
    );
  }
}
