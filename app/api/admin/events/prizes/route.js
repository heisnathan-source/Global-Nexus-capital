import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function admin(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const token = match ? match[1] : null;

  const session = token
    ? verifySessionToken(token)
    : null;

  return session && session.role === "admin"
    ? session
    : null;
}

const allowedTypes = [
  "points",
  "cash",
  "item",
  "lucky_draw",
];

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
    const eventId =
      String(body.eventId || "").trim();

    const prizeName =
      String(body.prizeName || "").trim();

    const requiredMembers =
      Math.trunc(Number(body.requiredMembers));

    const prizeType =
      allowedTypes.includes(body.prizeType)
        ? body.prizeType
        : null;

    const prizeValue =
      Number(body.prizeValue || 0);

    if (
      !eventId ||
      !prizeName ||
      !Number.isInteger(requiredMembers) ||
      requiredMembers < 1 ||
      !prizeType ||
      !Number.isFinite(prizeValue) ||
      prizeValue < 0
    ) {
      return Response.json(
        { error: "Enter valid prize settings." },
        { status: 400 }
      );
    }

    const db = getDb();

    const result = await db.query(
      `
        INSERT INTO event_member_prizes
        (
          event_id,
          required_members,
          prize_name,
          prize_type,
          prize_value,
          active,
          display_order
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
      `,
      [
        eventId,
        requiredMembers,
        prizeName,
        prizeType,
        prizeValue,
        body.active !== false,
        Math.trunc(
          Number(body.displayOrder || 0)
        ),
      ]
    );

    return Response.json(
      { prize: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Admin event prize POST failed:",
      error
    );

    return Response.json(
      { error: "Unable to create event prize." },
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
    const id =
      String(body.id || "").trim();

    const prizeName =
      String(body.prizeName || "").trim();

    const requiredMembers =
      Math.trunc(Number(body.requiredMembers));

    const prizeType =
      allowedTypes.includes(body.prizeType)
        ? body.prizeType
        : null;

    const prizeValue =
      Number(body.prizeValue || 0);

    if (
      !id ||
      !prizeName ||
      !Number.isInteger(requiredMembers) ||
      requiredMembers < 1 ||
      !prizeType ||
      !Number.isFinite(prizeValue) ||
      prizeValue < 0
    ) {
      return Response.json(
        { error: "Enter valid prize settings." },
        { status: 400 }
      );
    }

    const db = getDb();

    const result = await db.query(
      `
        UPDATE event_member_prizes
        SET
          required_members = $2,
          prize_name = $3,
          prize_type = $4,
          prize_value = $5,
          active = $6,
          display_order = $7,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        requiredMembers,
        prizeName,
        prizeType,
        prizeValue,
        body.active !== false,
        Math.trunc(
          Number(body.displayOrder || 0)
        ),
      ]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Prize not found." },
        { status: 404 }
      );
    }

    return Response.json({
      prize: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Admin event prize PUT failed:",
      error
    );

    return Response.json(
      { error: "Unable to update event prize." },
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

    const id =
      String(
        searchParams.get("id") || ""
      ).trim();

    if (!id) {
      return Response.json(
        { error: "Prize ID is required." },
        { status: 400 }
      );
    }

    const db = getDb();

    const claims = await db.query(
      `
        SELECT COUNT(*)::int AS count
        FROM event_member_reward_claims
        WHERE prize_id = $1
      `,
      [id]
    );

    if (
      Number(
        claims.rows[0]?.count || 0
      ) > 0
    ) {
      return Response.json(
        {
          error:
            "This prize already has reward records and cannot be deleted.",
        },
        { status: 409 }
      );
    }

    const deleted = await db.query(
      `
        DELETE FROM event_member_prizes
        WHERE id = $1
        RETURNING id
      `,
      [id]
    );

    if (!deleted.rowCount) {
      return Response.json(
        { error: "Prize not found." },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Admin event prize DELETE failed:",
      error
    );

    return Response.json(
      { error: "Unable to delete event prize." },
      { status: 500 }
    );
  }
}
