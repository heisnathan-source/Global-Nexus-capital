import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function admin(request) {
  const cookies =
    request.headers.get("cookie") || "";

  const match = cookies.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session && session.role === "admin"
    ? session
    : null;
}

async function getRankId(db, rankName) {
  if (!rankName) return null;

  const result = await db.query(
    `SELECT id FROM ranks WHERE name=$1 LIMIT 1`,
    [String(rankName).trim()]
  );

  return result.rowCount
    ? result.rows[0].id
    : null;
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

    const result = await db.query(`
      SELECT
        b.*,
        r.name AS rank_name
      FROM member_benefits b
      LEFT JOIN ranks r
        ON r.id = b.rank_id
      ORDER BY
        b.display_order,
        b.created_at DESC
    `);

    return Response.json({
      benefits: result.rows,
    });
  } catch (error) {
    console.error(
      "Admin member benefits GET failed:",
      error
    );

    return Response.json(
      { error: "Unable to load member benefits." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!admin(request)) {
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
      { error: "Invalid request data." },
      { status: 400 }
    );
  }

  try {
    const name = String(
      body.name || ""
    ).trim();

    if (!name) {
      return Response.json(
        { error: "Benefit name is required." },
        { status: 400 }
      );
    }

    const db = getDb();

    const rankId = await getRankId(
      db,
      body.rankName
    );

    const result = await db.query(
      `
        INSERT INTO member_benefits
        (
          name,
          description,
          rank_id,
          image_url,
          active,
          display_order
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
      `,
      [
        name,
        String(
          body.description || ""
        ).trim(),
        rankId,
        String(
          body.imageUrl || ""
        ).trim() || null,
        body.active !== false,
        Number(
          body.displayOrder || 0
        ),
      ]
    );

    return Response.json(
      { benefit: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Admin member benefit POST failed:",
      error
    );

    return Response.json(
      { error: "Unable to create member benefit." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  if (!admin(request)) {
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
      { error: "Invalid request data." },
      { status: 400 }
    );
  }

  try {
    if (!body.id) {
      return Response.json(
        { error: "Benefit ID is required." },
        { status: 400 }
      );
    }

    const name = String(
      body.name || ""
    ).trim();

    if (!name) {
      return Response.json(
        { error: "Benefit name is required." },
        { status: 400 }
      );
    }

    const db = getDb();

    const rankId = await getRankId(
      db,
      body.rankName
    );

    const result = await db.query(
      `
        UPDATE member_benefits
        SET
          name=$1,
          description=$2,
          rank_id=$3,
          image_url=$4,
          active=$5,
          display_order=$6
        WHERE id=$7
        RETURNING *
      `,
      [
        name,
        String(
          body.description || ""
        ).trim(),
        rankId,
        String(
          body.imageUrl || ""
        ).trim() || null,
        body.active !== false,
        Number(
          body.displayOrder || 0
        ),
        body.id,
      ]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Benefit not found." },
        { status: 404 }
      );
    }

    return Response.json({
      benefit: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Admin member benefit PUT failed:",
      error
    );

    return Response.json(
      { error: "Unable to update member benefit." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  if (!admin(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } =
      new URL(request.url);

    const id = searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "Benefit ID is required." },
        { status: 400 }
      );
    }

    const db = getDb();

    const result = await db.query(
      `
        DELETE FROM member_benefits
        WHERE id=$1
        RETURNING id
      `,
      [id]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Benefit not found." },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Admin member benefit DELETE failed:",
      error
    );

    return Response.json(
      { error: "Unable to delete member benefit." },
      { status: 500 }
    );
  }
}
