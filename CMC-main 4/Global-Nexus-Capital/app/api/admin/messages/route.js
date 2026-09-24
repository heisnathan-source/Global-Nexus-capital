import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

function admin(request) {
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


/*
========================================
GET ALL MESSAGES
========================================
*/

export async function GET(request) {
  if (!admin(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await getDb().query(`
      SELECT *
      FROM messages
      ORDER BY created_at DESC
    `);

    return Response.json({
      messages: result.rows
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to load messages."
      },
      { status: 500 }
    );

  }
}


/*
========================================
CREATE MESSAGE
========================================
*/

export async function POST(request) {
  const session = admin(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {

    const body = await request.json();

    const title =
      String(body.title || "").trim();

    const message =
      String(body.body || "").trim();

    if (!title || !message) {
      return Response.json(
        {
          error:
            "Title and message are required."
        },
        { status: 400 }
      );
    }

    const db = getDb();

    const result = await db.query(
      `
      INSERT INTO messages(
        title,
        body,
        image_url,
        active,
        publish_at,
        expires_at,
        created_by
      )
      VALUES($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        title,
        message,
        body.imageUrl || null,
        body.active !== false,
        body.publishAt || null,
        body.expiresAt || null,
        session.userId
      ]
    );

    return Response.json(
      {
        message: result.rows[0]
      },
      { status: 201 }
    );

  } catch (error) {

    return Response.json(
      {
        error: "Unable to create message."
      },
      { status: 400 }
    );

  }
}


/*
========================================
EDIT MESSAGE
========================================
*/

export async function PUT(request) {
  if (!admin(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {

    const body = await request.json();

    const messageId =
      String(body.id || "").trim();

    const title =
      String(body.title || "").trim();

    const message =
      String(body.body || "").trim();

    if (!messageId) {
      return Response.json(
        { error: "Message ID is required." },
        { status: 400 }
      );
    }

    if (!title || !message) {
      return Response.json(
        {
          error:
            "Title and message are required."
        },
        { status: 400 }
      );
    }

    const result = await getDb().query(
      `
      UPDATE messages
      SET
        title = $1,
        body = $2,
        image_url = $3,
        active = $4,
        publish_at = $5,
        expires_at = $6
      WHERE id = $7
      RETURNING *
      `,
      [
        title,
        message,
        body.imageUrl || null,
        body.active !== false,
        body.publishAt || null,
        body.expiresAt || null,
        messageId
      ]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Message not found." },
        { status: 404 }
      );
    }

    return Response.json({
      message: result.rows[0]
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to update message."
      },
      { status: 400 }
    );

  }
}


/*
========================================
REMOVE MESSAGE
========================================
*/

export async function DELETE(request) {
  if (!admin(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {

    const { id } =
      await request.json();

    const messageId =
      String(id || "").trim();

    if (!messageId) {
      return Response.json(
        { error: "Message ID is required." },
        { status: 400 }
      );
    }

    /*
     * Remove user read records first.
     * This prevents foreign-key problems.
     */

    const db = getDb();

    await db.query(
      `
      DELETE FROM user_messages
      WHERE message_id = $1
      `,
      [messageId]
    );

    const result = await db.query(
      `
      DELETE FROM messages
      WHERE id = $1
      RETURNING id
      `,
      [messageId]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Message not found." },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      message:
        "Message removed successfully."
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to remove message."
      },
      { status: 400 }
    );

  }
}
