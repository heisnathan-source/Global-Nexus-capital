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

  const db = getDb();
  const client = await db.connect();

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

    await client.query("BEGIN");

    /*
     * Create the event first.
     */
    const result =
      await client.query(
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

    const event =
      result.rows[0];

    /*
     * Future Lucky Card configuration.
     *
     * 1,000 total draw numbers:
     *
     * 650 = 20
     * 300 = 60
     *  50 = 300
     *
     * The complete prize pool is shuffled with RANDOM()
     * and then assigned to draw numbers 1-1000.
     *
     * Box positions are independently randomized 1-6.
     *
     * These are POINTS prizes, not cash prizes.
     */
    const raffleEnabled =
      await client.query(
        `
        SELECT enabled
        FROM lucky_card_event_defaults
        WHERE id = TRUE
        LIMIT 1
        `
      );

    if (
      raffleEnabled.rows[0]?.enabled === true
    ) {

      await client.query(
        `
        INSERT INTO lucky_card_rules
          (
            event_id,
            rank_id,
            draws_required,
            draw_number,
            prize_name,
            prize_amount,
            prize_type,
            max_winners,
            box_position,
            active
          )

        SELECT
          $1,
          NULL,
          1,
          draw_number,
          prize_name,
          prize_amount,
          'points',
          0,
          1 + FLOOR(RANDOM() * 6)::int,
          TRUE

        FROM (

          SELECT
            ROW_NUMBER() OVER (
              ORDER BY RANDOM()
            )::int AS draw_number,

            prize_name,
            prize_amount

          FROM (

            /*
             * 650 x 20
             */
            SELECT
              '20 Cedi Prize'::text AS prize_name,
              20::numeric AS prize_amount
            FROM generate_series(1, 650)

            UNION ALL

            /*
             * 300 x 60
             */
            SELECT
              '60 Cedi Prize'::text,
              60::numeric
            FROM generate_series(1, 300)

            UNION ALL

            /*
             * 50 x 300
             */
            SELECT
              '300 Cedi Prize'::text,
              300::numeric
            FROM generate_series(1, 50)

          ) AS prize_pool

        ) AS randomized_pool

        ORDER BY draw_number
        `,
        [event.id]
      );

    }

    await client.query("COMMIT");

    return Response.json(
      {
        event
      },
      {
        status: 201
      }
    );

  } catch (error) {

    await client.query("ROLLBACK");

    console.error(
      "Admin events POST:",
      error
    );

    return Response.json(
      {
        error:
          "Could not create event."
      },
      {
        status: 400
      }
    );

  } finally {

    client.release();

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
