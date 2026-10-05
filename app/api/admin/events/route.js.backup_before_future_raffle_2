import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";


function admin(request) {

  const cookie =
    request.headers.get("cookie") || "";

  const match =
    cookie.match(
      new RegExp(
        `${ADMIN_COOKIE_NAME}=([^;]+)`
      )
    );

  const token =
    match ? match[1] : null;

  const session =
    token
      ? verifySessionToken(token)
      : null;

  return session &&
    session.role === "admin"
    ? session
    : null;
}


/*
 * GET
 * Load all events for the admin.
 */
export async function GET(request) {

  if (!admin(request)) {

    return Response.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );

  }


  try {

    const db =
      getDb();


    const result =
      await db.query(
        `
        SELECT
          e.id,
          e.name,
          e.description,
          e.banner_url,
          e.start_at,
          e.end_at,
          e.status,
          e.created_at,

          COALESCE(
            json_agg(
              json_build_object(
                'id', p.id,
                'requiredMembers',
                  p.required_members,
                'prizeName',
                  p.prize_name,
                'prizeType',
                  p.prize_type,
                'prizeValue',
                  p.prize_value,
                'active',
                  p.active,
                'displayOrder',
                  p.display_order
              )
              ORDER BY
                p.required_members ASC,
                p.display_order ASC
            )
            FILTER (
              WHERE p.id IS NOT NULL
            ),
            '[]'
          ) AS prizes

        FROM events e

        LEFT JOIN event_member_prizes p
          ON p.event_id = e.id

        GROUP BY e.id

        ORDER BY
          e.created_at DESC
        `
      );


    return Response.json({
      events: result.rows
    });

  } catch (error) {

    console.error(
      "Admin events GET:",
      error
    );

    return Response.json(
      {
        error: "Could not load events."
      },
      {
        status: 500
      }
    );

  }

}


/*
 * POST
 * Create a new event.
 */
export async function POST(request) {

  if (!admin(request)) {

    return Response.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );

  }


  try {

    const body =
      await request.json();


    const name =
      String(
        body.name || ""
      ).trim();


    if (!name) {

      return Response.json(
        {
          error:
            "Event name is required."
        },
        {
          status: 400
        }
      );

    }


    const allowedStatuses = [
      "draft",
      "locked",
      "active",
      "ended"
    ];


    const status =
      allowedStatuses.includes(
        body.status
      )
        ? body.status
        : "draft";


    const db =
      getDb();


    const result =
      await db.query(
        `
        INSERT INTO events
          (
            name,
            description,
            banner_url,
            start_at,
            end_at,
            status
          )
        VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
        RETURNING *
        `,
        [
          name,

          String(
            body.description || ""
          ).trim() || null,

          String(
            body.bannerUrl || ""
          ).trim() || null,

          body.startAt || null,

          body.endAt || null,

          status
        ]
      );


    return Response.json(
      {
        event:
          result.rows[0]
      },
      {
        status: 201
      }
    );

  } catch (error) {

    console.error(
      "Admin events POST:",
      error
    );

    return Response.json(
      {
        error: "Could not create event."
      },
      {
        status: 400
      }
    );

  }

}


/*
 * PUT
 * Update an existing event.
 */
export async function PUT(request) {

  if (!admin(request)) {

    return Response.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );

  }


  try {

    const body =
      await request.json();


    const id =
      String(
        body.id || ""
      ).trim();


    const name =
      String(
        body.name || ""
      ).trim();


    if (!id || !name) {

      return Response.json(
        {
          error:
            "Event ID and name are required."
        },
        {
          status: 400
        }
      );

    }


    const allowedStatuses = [
      "draft",
      "locked",
      "active",
      "ended"
    ];


    const status =
      allowedStatuses.includes(
        body.status
      )
        ? body.status
        : "draft";


    const db =
      getDb();


    const result =
      await db.query(
        `
        UPDATE events
        SET
          name = $2,
          description = $3,
          banner_url = $4,
          start_at = $5,
          end_at = $6,
          status = $7
        WHERE id = $1
        RETURNING *
        `,
        [
          id,

          name,

          String(
            body.description || ""
          ).trim() || null,

          String(
            body.bannerUrl || ""
          ).trim() || null,

          body.startAt || null,

          body.endAt || null,

          status
        ]
      );


    if (!result.rowCount) {

      return Response.json(
        {
          error:
            "Event not found."
        },
        {
          status: 404
        }
      );

    }


    return Response.json({
      event:
        result.rows[0]
    });

  } catch (error) {

    console.error(
      "Admin events PUT:",
      error
    );

    return Response.json(
      {
        error: "Could not update event."
      },
      {
        status: 400
      }
    );

  }

}


/*
 * DELETE
 *
 * Permanently remove an event only when
 * it has not created reward records.
 *
 * This protects member balances,
 * points and Lucky Card rewards.
 */
export async function DELETE(request) {

  if (!admin(request)) {

    return Response.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );

  }


  const db =
    getDb();


  const client =
    await db.connect();


  try {

    const { searchParams } =
      new URL(request.url);


    const id =
      String(
        searchParams.get("id") || ""
      ).trim();


    if (!id) {

      return Response.json(
        {
          error:
            "Event ID is required."
        },
        {
          status: 400
        }
      );

    }


    await client.query(
      "BEGIN"
    );


    /*
     * Check whether this event has already
     * created member reward records.
     */
    const claims =
      await client.query(
        `
        SELECT
          COUNT(*)::int AS count
        FROM event_member_reward_claims
        WHERE event_id = $1
        `,
        [
          id
        ]
      );


    const rewardCount =
      Number(
        claims.rows[0]?.count || 0
      );


    /*
     * Do not permanently delete events
     * that already affected user rewards.
     */
    if (rewardCount > 0) {

      await client.query(
        "ROLLBACK"
      );

      return Response.json(
        {
          error:
            "This event already has member reward records and cannot be permanently deleted. Its reward history must be preserved."
        },
        {
          status: 409
        }
      );

    }


    /*
     * Remove all prizes first.
     */
    await client.query(
      `
      DELETE FROM event_member_prizes
      WHERE event_id = $1
      `,
      [
        id
      ]
    );


    /*
     * Remove the event itself.
     */
    const deleted =
      await client.query(
        `
        DELETE FROM events
        WHERE id = $1
        RETURNING
          id,
          name
        `,
        [
          id
        ]
      );


    if (!deleted.rowCount) {

      await client.query(
        "ROLLBACK"
      );

      return Response.json(
        {
          error:
            "Event not found."
        },
        {
          status: 404
        }
      );

    }


    await client.query(
      "COMMIT"
    );


    return Response.json({
      success: true,

      message:
        "Event removed successfully.",

      event:
        deleted.rows[0]
    });

  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    console.error(
      "Admin events DELETE:",
      error
    );

    return Response.json(
      {
        error: "Could not remove event."
      },
      {
        status: 500
      }
    );

  } finally {

    client.release();

  }

}
