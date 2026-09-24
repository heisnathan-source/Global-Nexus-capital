import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

function session(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const data = match
    ? verifySessionToken(match[1])
    : null;

  return data && data.role === "user"
    ? data
    : null;
}

function publicPointsPurchaseError(error) {
  const message = String(error?.message || "");

  const allowed = new Set([
    "Points Card is currently unavailable.",
    "This item no longer exists.",
    "This item is currently unavailable.",
    "You do not have a Points Card balance yet.",
    "You do not have enough points for this item."
  ]);

  return allowed.has(message)
    ? message
    : "Unable to redeem this item.";
}


export async function POST(request) {
  const user = session(request);

  if (!user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let client;

  try {
    const accountCheck = await getDb().query(
      `
      SELECT enabled
      FROM users
      WHERE id = $1
        AND role = 'user'
      `,
      [user.userId]
    );

    if (!accountCheck.rowCount) {
      return Response.json(
        { error: "Unable to complete this request." },
        { status: 403 }
      );
    }

    if (!accountCheck.rows[0].enabled) {
      return Response.json(
        { error: "Account is currently disabled." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const itemId = String(body?.itemId || "").trim();

    if (!itemId) {
      return Response.json(
        { error: "Points Shop item is required." },
        { status: 400 }
      );
    }

    const db = getDb();

    client = await db.connect();

    await client.query("BEGIN");

    /*
     * Make sure the Points Card system
     * is currently enabled.
     */
    const settings = await client.query(`
      SELECT points_cards_enabled
      FROM admin_platform_settings
      WHERE id = TRUE
      LIMIT 1
    `);

    if (
      settings.rowCount &&
      settings.rows[0].points_cards_enabled !== true
    ) {
      throw new Error("Points Card is currently unavailable.");
    }


    /*
     * Lock the shop item while purchasing.
     */
    const itemResult = await client.query(
      `
      SELECT
        id,
        name,
        description,
        image_url,
        points_required,
        active
      FROM points_shop_items
      WHERE id = $1
      FOR UPDATE
      `,
      [itemId]
    );

    if (!itemResult.rowCount) {
      throw new Error("This item no longer exists.");
    }

    const item = itemResult.rows[0];

    if (!item.active) {
      throw new Error(
        "This item is currently unavailable."
      );
    }


    /*
     * Lock the user's points account.
     */
    const accountResult = await client.query(
      `
      SELECT
        user_id,
        balance
      FROM point_accounts
      WHERE user_id = $1
      FOR UPDATE
      `,
      [user.userId]
    );

    if (!accountResult.rowCount) {
      throw new Error(
        "You do not have a Points Card balance yet."
      );
    }

    const currentBalance = Number(
      accountResult.rows[0].balance || 0
    );

    const pointsRequired = Number(
      item.points_required || 0
    );

    if (currentBalance < pointsRequired) {
      throw new Error(
        "You do not have enough points for this item."
      );
    }


    /*
     * Deduct the points.
     */
    const newBalance =
      currentBalance - pointsRequired;

    await client.query(
      `
      UPDATE point_accounts
      SET balance = $2
      WHERE user_id = $1
      `,
      [
        user.userId,
        newBalance
      ]
    );


    /*
     * Record the deduction in the Points Card ledger.
     */
    await client.query(
      `
      INSERT INTO point_ledger(
        user_id,
        type,
        points,
        description,
        created_at
      )
      VALUES(
        $1,
        $2,
        $3,
        $4,
        NOW()
      )
      `,
      [
        user.userId,
        "redemption",
        pointsRequired,
        `Redeemed points for: ${item.name}`
      ]
    );


    /*
     * Create the permanent purchase record.
     *
     * Item details are copied into the purchase record
     * so the user's history remains correct even if
     * the admin later edits or deletes the shop item.
     */
    const purchaseResult = await client.query(
      `
      INSERT INTO points_shop_purchases(
        user_id,
        item_id,
        item_name,
        item_description,
        item_image_url,
        points_spent,
        fulfillment_status,
        created_at
      )
      VALUES(
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'pending',
        NOW()
      )
      RETURNING *
      `,
      [
        user.userId,
        item.id,
        item.name,
        item.description,
        item.image_url,
        pointsRequired
      ]
    );


    await client.query("COMMIT");

    return Response.json({
      ok: true,

      message:
        "Congratulations! Your item has been redeemed successfully.",

      balance: newBalance,

      purchase:
        purchaseResult.rows[0]
    });

  } catch (error) {

    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    console.error(
      "POINTS SHOP PURCHASE ERROR:",
      error
    );

    return Response.json(
      {
        error:
          publicPointsPurchaseError(error)
      },
      {
        status: 400
      }
    );

  } finally {

    if (client) {
      client.release();
    }

  }
}
