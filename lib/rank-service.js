import { getDb } from "./db.js";
import { qualifyReferralFromRankPurchase } from "./qualification-service.js";
import { creditReferralCommissions } from "./commission-service.js";
import { processMemberEventRewards } from "./member-event-service.js";

export const CMC_RANKS = [
  ["STARTER", 1, 3],
  ["GROWTH", 2, 5],
  ["SUPER", 3, 7],
  ["ELITE", 4, 10],
  ["PREMIER", 5, 13],
  ["PREMIUM", 6, 16],
  ["LEGACY", 7, 20],
  ["ULTIMATE", 8, 25],
  ["SUPREME", 9, 30],
];

export async function ensureCanonicalRanks() {
  const db = getDb();

  for (const [name, number, division] of CMC_RANKS) {
    await db.query(
      `
      INSERT INTO ranks(name, rank_number)
      VALUES($1, $2)
      ON CONFLICT(name)
      DO UPDATE SET rank_number = EXCLUDED.rank_number
      `,
      [name, number]
    );
  }
}

export async function getRankCatalog(userId) {
  const db = getDb();

  const ranks = (
    await db.query(
      `
      SELECT
        r.id,
        r.name,
        r.rank_number,
        COALESCE(rr.purchase_price, 0) AS purchase_price,
        COALESCE(rr.daily_earning, 0) AS daily_earning,
        COALESCE(rr.division_count, 1) AS division_count,
        rr.color_hex,
        rr.banner_url,
        COALESCE(urp.status, 'none') AS purchase_status
      FROM ranks r
      LEFT JOIN rank_purchase_rules rr
        ON rr.rank_id = r.id
      LEFT JOIN user_rank_purchases urp
        ON urp.rank_id = r.id
        AND urp.user_id = $1
      WHERE r.rank_number BETWEEN 1 AND 9
      ORDER BY r.rank_number
      `,
      [userId]
    )
  ).rows;

  const highestPurchased = Math.max(
    0,
    ...ranks
      .filter((r) => r.purchase_status === "active")
      .map((r) => Number(r.rank_number))
  );

  return ranks.map((r) => {
    const n = Number(r.rank_number);

    // The purchased rank and all lower ranks remain locked.
    const locked = n <= highestPurchased;

    const purchasePrice = Number(r.purchase_price || 0);

    return {
      ...r,
      purchase_price: purchasePrice,

      direct_referral_rate: 8,
      second_referral_rate: 2,
      third_referral_rate: 1,

      direct_referral_earning: purchasePrice * 0.08,
      second_referral_earning: purchasePrice * 0.02,
      third_referral_earning: purchasePrice * 0.01,

      locked,
      availableForPurchase: !locked,
    };
  });
}

export async function purchaseRank(userId, rankId) {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    /*
     * A rank must have an explicit purchase rule.
     *
     * Do NOT use COALESCE(..., 0) here because a missing
     * configuration must never silently turn into a free rank.
     *
     * An explicitly configured purchase_price of 0 remains
     * distinguishable from a missing purchase rule.
     */
    const q = await client.query(
      `
      SELECT
        r.id,
        r.name,
        r.rank_number,
        rr.purchase_price
      FROM ranks r
      JOIN rank_purchase_rules rr
        ON rr.rank_id = r.id
      WHERE r.id = $1
        AND r.rank_number BETWEEN 1 AND 9
      FOR UPDATE OF r
      `,
      [rankId]
    );

    if (!q.rowCount) {
      throw new Error(
        "Rank not found or purchase settings are not configured."
      );
    }

    const rank = q.rows[0];

    const price = Number(rank.purchase_price);

    /*
     * Fail closed if the configured database value is invalid.
     * Zero is allowed because the admin configuration currently
     * permits an explicitly configured zero purchase price.
     */
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(
        "This rank is not available because its purchase settings are invalid."
      );
    }

    const account = await client.query(
      `
      SELECT
        id,
        enabled
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (!account.rowCount) {
      throw new Error("User not found.");
    }

    if (!account.rows[0].enabled) {
      throw new Error("Account is currently disabled.");
    }

    const purchased = await client.query(
      `
      SELECT MAX(r.rank_number)::int AS highest
      FROM user_rank_purchases urp
      JOIN ranks r
        ON r.id = urp.rank_id
      WHERE urp.user_id = $1
        AND urp.status = 'active'
      `,
      [userId]
    );

    const highest = Number(
      purchased.rows[0].highest || 0
    );

    const n = Number(rank.rank_number);

    if (n <= highest) {
      throw new Error(
        "This rank is locked because it has already been purchased or is below your current purchase position."
      );
    }

    const wallet = await client.query(
      `
      SELECT available_balance
      FROM wallets
      WHERE user_id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (
      !wallet.rowCount ||
      Number(wallet.rows[0].available_balance) < price
    ) {
      throw new Error("Insufficient available balance.");
    }

    const after =
      Number(wallet.rows[0].available_balance) - price;

    await client.query(
      `
      UPDATE wallets
      SET
        available_balance = $1,
        updated_at = NOW()
      WHERE user_id = $2
      `,
      [after, userId]
    );

    const purchase = await client.query(
      `
      INSERT INTO user_rank_purchases
        (user_id, rank_id, purchase_price)
      VALUES
        ($1, $2, $3)
      ON CONFLICT(user_id, rank_id)
      DO NOTHING
      RETURNING *
      `,
      [userId, rank.id, price]
    );

    if (!purchase.rowCount) {
      throw new Error(
        "This rank has already been purchased."
      );
    }

    // Current rank is the highest purchased rank.
    await client.query(
      `
      UPDATE users
      SET rank_id = $1
      WHERE id = $2
      `,
      [rank.id, userId]
    );

    const tx = await client.query(
      `
      INSERT INTO transactions
        (
          user_id,
          type,
          amount,
          fee,
          status,
          reference,
          metadata
        )
      VALUES
        (
          $1,
          'rank_purchase',
          $2,
          0,
          'successful',
          $3,
          $4
        )
      RETURNING id
      `,
      [
        userId,
        price,
        `RANK-${purchase.rows[0].id}`,
        JSON.stringify({
          rankId: rank.id,
          rankName: rank.name,
        }),
      ]
    );

    await client.query(
      `
      INSERT INTO wallet_ledger
        (
          user_id,
          transaction_id,
          entry_type,
          amount,
          balance_after,
          description
        )
      VALUES
        (
          $1,
          $2,
          'rank_purchase',
          $3,
          $4,
          $5
        )
      `,
      [
        userId,
        tx.rows[0].id,
        -price,
        after,
        `Purchased ${rank.name}`,
      ]
    );

    await client.query("COMMIT");

    /*
     * Global Nexus Capital RULE:
     * Purchasing ANY rank qualifies the user
     * as a qualifying referral.
     */
    await qualifySuccessfulRankPurchase(
      userId,
      purchase.rows[0].id,
      rank.id
    );

    await creditReferralCommissions(
      userId,
      tx.rows[0].id,
      price
    );

    return {
      purchase: purchase.rows[0],
      rankName: rank.name,
      balanceAfter: after,
    };

  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    throw e;

  } finally {
    client.release();
  }
}

export async function qualifySuccessfulRankPurchase(
  userId,
  rankPurchaseId,
  rankId
) {
  return qualifyReferralFromRankPurchase(
    userId,
    rankPurchaseId,
    rankId
  );
}
