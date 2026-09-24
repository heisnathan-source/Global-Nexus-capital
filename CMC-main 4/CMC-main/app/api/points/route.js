import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";

function session(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match =
    cookie.match(
      new RegExp(
        `${USER_COOKIE_NAME}=([^;]+)`
      )
    );

  const data =
    match
      ? verifySessionToken(match[1])
      : null;

  return data &&
    data.role === "user"
    ? data
    : null;
}

export async function GET(request) {
  const user = session(request);

  if (!user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    /*
     * Check whether Points Cards
     * are enabled by the admin.
     */
    const settingsResult =
      await db.query(`
        SELECT points_cards_enabled
        FROM admin_platform_settings
        WHERE id = TRUE
        LIMIT 1
      `);

    const enabled =
      settingsResult.rows[0]
        ?.points_cards_enabled === true;

    /*
     * If disabled, do not expose
     * shop items or purchases.
     */
    if (!enabled) {
      return Response.json({
        enabled: false,
        balance: 0,
        ledger: [],
        rewards: [],
        items: [],
        purchases: []
      });
    }


    /*
     * Load everything needed for
     * the user's Points Card page.
     */
    const [
      accountResult,
      ledgerResult,
      itemsResult,
      purchasesResult
    ] = await Promise.all([

      /*
       * Current points balance.
       */
      db.query(
        `
        SELECT balance
        FROM point_accounts
        WHERE user_id = $1
        `,
        [user.userId]
      ),


      /*
       * Points Card transaction history.
       */
      db.query(
        `
        SELECT
          type,
          points,
          description,
          created_at
        FROM point_ledger
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100
        `,
        [user.userId]
      ),


      /*
       * Unlimited active shop items.
       */
      db.query(`
        SELECT
          id,
          name,
          description,
          image_url,
          points_required,
          created_at
        FROM points_shop_items
        WHERE active = TRUE
        ORDER BY created_at DESC
      `),


      /*
       * Complete purchase history
       * for the logged-in user.
       */
      db.query(
        `
        SELECT
          id,
          item_id,
          item_name,
          item_description,
          item_image_url,
          points_spent,
          fulfillment_status,
          fulfillment_note,
          fulfilled_at,
          created_at
        FROM points_shop_purchases
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [user.userId]
      )

    ]);


    return Response.json({

      enabled: true,

      balance:
        Number(
          accountResult.rows[0]
            ?.balance || 0
        ),

      ledger:
        ledgerResult.rows,

      /*
       * New unlimited Points Shop.
       */
      items:
        itemsResult.rows,

      /*
       * User's permanent purchase history.
       */
      purchases:
        purchasesResult.rows,

      /*
       * Keep this temporarily for
       * compatibility with the old
       * Points Card page.
       */
      rewards:
        []

    });

  } catch (error) {

    console.error(
      "POINTS CARD GET ERROR:",
      error
    );

    return Response.json(
      {
        error: "Unable to load Points Card."
      },
      {
        status: 500
      }
    );

  }
}
