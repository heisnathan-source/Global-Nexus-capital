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

  const session =
    match
      ? verifySessionToken(match[1])
      : null;

  return session &&
    session.role === "admin"
    ? session
    : null;

}


/* =========================================
   GET
   Load unlimited shop items and all purchases
========================================= */

export async function GET(request) {

  if (!admin(request)) {

    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );

  }

  try {

    const db = getDb();

    const [
      itemsResult,
      purchasesResult
    ] = await Promise.all([

      db.query(`
        SELECT
          id,
          name,
          description,
          image_url,
          points_required,
          active,
          created_at,
          updated_at

        FROM points_shop_items

        ORDER BY
          created_at DESC
      `),


      db.query(`
        SELECT
          p.id,

          p.user_id,

          p.item_id,

          p.item_name,
          p.item_description,
          p.item_image_url,

          p.points_spent,

          p.fulfillment_status,
          p.fulfillment_note,
          p.fulfilled_at,

          p.created_at,

          u.name AS user_name,
          u.phone AS user_phone,
          u.account_id

        FROM points_shop_purchases p

        LEFT JOIN users u
          ON u.id = p.user_id

        ORDER BY
          p.created_at DESC
      `)

    ]);


    return Response.json({

      items:
        itemsResult.rows,

      purchases:
        purchasesResult.rows

    });

  } catch (error) {

    console.error(
      "ADMIN POINTS GET ERROR:",
      error
    );

    return Response.json(
      {
        error: "Unable to load Points Shop."
      },
      {
        status: 500
      }
    );

  }

}


/* =========================================
   POST
   Create a new unlimited Points Shop item
========================================= */

export async function POST(request) {

  if (!admin(request)) {

    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );

  }

  try {

    const body =
      await request.json();

    const name =
      String(body?.name || "").trim();

    const description =
      String(body?.description || "").trim();

    const imageUrl =
      String(body?.imageUrl || "").trim();

    const pointsRequired =
      Math.trunc(
        Number(body?.pointsRequired)
      );


    if (!name) {

      return Response.json(
        {
          error:
            "Item name is required."
        },
        {
          status: 400
        }
      );

    }


    if (
      !Number.isFinite(pointsRequired) ||
      pointsRequired < 0
    ) {

      return Response.json(
        {
          error:
            "Please enter a valid number of points."
        },
        {
          status: 400
        }
      );

    }


    const db =
      getDb();


    const result =
      await db.query(
        `
        INSERT INTO points_shop_items(

          name,
          description,
          image_url,
          points_required,
          active,
          created_at,
          updated_at

        )

        VALUES(

          $1,
          $2,
          $3,
          $4,
          TRUE,
          NOW(),
          NOW()

        )

        RETURNING *
        `,
        [

          name,

          description || null,

          imageUrl || null,

          pointsRequired

        ]
      );


    return Response.json(
      {
        message:
          "Points Shop item created successfully.",

        item:
          result.rows[0]
      },
      {
        status: 201
      }
    );

  } catch (error) {

    console.error(
      "ADMIN POINTS CREATE ERROR:",
      error
    );

    return Response.json(
      {
        error: "Unable to create Points Shop item."
      },
      {
        status: 400
      }
    );

  }

}


/* =========================================
   PATCH
   Edit an item OR update purchase fulfillment
========================================= */

export async function PATCH(request) {

  if (!admin(request)) {

    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );

  }

  try {

    const body =
      await request.json();


    const action =
      String(body?.action || "");


    const db =
      getDb();


    /* =====================================
       UPDATE SHOP ITEM
    ===================================== */

    if (action === "update-item") {

      const id =
        String(body?.id || "").trim();

      const name =
        String(body?.name || "").trim();

      const description =
        String(
          body?.description || ""
        ).trim();

      const imageUrl =
        String(
          body?.imageUrl || ""
        ).trim();

      const pointsRequired =
        Math.trunc(
          Number(body?.pointsRequired)
        );

      const active =
        body?.active === true;


      if (!id || !name) {

        return Response.json(
          {
            error:
              "Item ID and name are required."
          },
          {
            status: 400
          }
        );

      }


      if (
        !Number.isFinite(pointsRequired) ||
        pointsRequired < 0
      ) {

        return Response.json(
          {
            error:
              "Please enter a valid number of points."
          },
          {
            status: 400
          }
        );

      }


      const result =
        await db.query(
          `
          UPDATE points_shop_items

          SET

            name = $2,

            description = $3,

            image_url = $4,

            points_required = $5,

            active = $6,

            updated_at = NOW()

          WHERE id = $1

          RETURNING *
          `,
          [

            id,

            name,

            description || null,

            imageUrl || null,

            pointsRequired,

            active

          ]
        );


      if (!result.rowCount) {

        return Response.json(
          {
            error:
              "Points Shop item not found."
          },
          {
            status: 404
          }
        );

      }


      return Response.json({

        message:
          "Item updated successfully.",

        item:
          result.rows[0]

      });

    }


    /* =====================================
       UPDATE PURCHASE FULFILLMENT
    ===================================== */

    if (action === "update-purchase") {

      const id =
        String(body?.id || "").trim();

      const fulfillmentStatus =
        String(
          body?.fulfillmentStatus ||
          ""
        ).trim();

      const fulfillmentNote =
        String(
          body?.fulfillmentNote || ""
        ).trim();


      const allowedStatuses = [

        "pending",

        "contacted",

        "processing",

        "fulfilled"

      ];


      if (!id) {

        return Response.json(
          {
            error:
              "Purchase ID is required."
          },
          {
            status: 400
          }
        );

      }


      if (
        !allowedStatuses.includes(
          fulfillmentStatus
        )
      ) {

        return Response.json(
          {
            error:
              "Invalid fulfillment status."
          },
          {
            status: 400
          }
        );

      }


      const result =
        await db.query(
          `
          UPDATE points_shop_purchases

          SET

            fulfillment_status = $2,

            fulfillment_note = $3,

            fulfilled_at =
              CASE

                WHEN $2 = 'fulfilled'
                THEN NOW()

                ELSE fulfilled_at

              END

          WHERE id = $1

          RETURNING *
          `,
          [

            id,

            fulfillmentStatus,

            fulfillmentNote || null

          ]
        );


      if (!result.rowCount) {

        return Response.json(
          {
            error:
              "Purchase record not found."
          },
          {
            status: 404
          }
        );

      }


      return Response.json({

        message:
          "Purchase record updated successfully.",

        purchase:
          result.rows[0]

      });

    }


    return Response.json(
      {
        error:
          "Invalid Points Shop action."
      },
      {
        status: 400
      }
    );

  } catch (error) {

    console.error(
      "ADMIN POINTS UPDATE ERROR:",
      error
    );

    return Response.json(
      {
        error: "Unable to update Points Shop."
      },
      {
        status: 400
      }
    );

  }

}


/* =========================================
   DELETE
   Remove a shop item
========================================= */

export async function DELETE(request) {

  if (!admin(request)) {

    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );

  }

  try {

    const body =
      await request.json();

    const id =
      String(body?.id || "").trim();


    if (!id) {

      return Response.json(
        {
          error:
            "Item ID is required."
        },
        {
          status: 400
        }
      );

    }


    const db =
      getDb();


    const result =
      await db.query(
        `
        DELETE FROM points_shop_items

        WHERE id = $1

        RETURNING id
        `,
        [id]
      );


    if (!result.rowCount) {

      return Response.json(
        {
          error:
            "Points Shop item not found."
        },
        {
          status: 404
        }
      );

    }


    return Response.json({

      message:
        "Points Shop item removed successfully.",

      id

    });

  } catch (error) {

    console.error(
      "ADMIN POINTS DELETE ERROR:",
      error
    );

    return Response.json(
      {
        error: "Unable to remove Points Shop item."
      },
      {
        status: 400
      }
    );

  }

}
