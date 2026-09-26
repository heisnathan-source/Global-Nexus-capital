import { getDb } from "./db.js";

/*
  Global Nexus Capital Referral Commission Rules

  Level 1 = 8%
  Level 2 = 2%
  Level 3 = 1%

  Referral commissions are created only from a legitimate,
  successful rank-purchase transaction.

  The source transaction is the idempotency key. The database
  constraint prevents the same beneficiary from receiving the
  same level commission twice for the same source transaction.
*/

export async function creditReferralCommissions(
  sourceUserId,
  sourceTransactionId,
  baseAmount
) {
  const db = getDb();
  const client = await db.connect();

  try {
    /*
     * Basic internal-input validation.
     *
     * This function is called by trusted server-side code,
     * but it moves real wallet funds, so fail closed.
     */
    if (!sourceUserId || !sourceTransactionId) {
      throw new Error(
        "Invalid commission source."
      );
    }

    const requestedBaseAmount =
      Number(baseAmount);

    if (
      !Number.isFinite(requestedBaseAmount) ||
      requestedBaseAmount <= 0
    ) {
      throw new Error(
        "Invalid commission amount."
      );
    }

    await client.query("BEGIN");

    /*
     * Verify the source account.
     *
     * Commissions must originate from an enabled,
     * normal Global Nexus Capital user account.
     */
    const sourceUser = await client.query(
      `
      SELECT
        id
      FROM users
      WHERE
        id = $1
        AND role = 'user'
        AND enabled = TRUE
      FOR UPDATE
      `,
      [sourceUserId]
    );

    if (!sourceUser.rowCount) {
      throw new Error(
        "Invalid commission source user."
      );
    }

    /*
     * Verify the source transaction.
     *
     * Referral commissions can only originate from:
     *
     *   - the supplied source user
     *   - a successful transaction
     *   - transaction type = rank_purchase
     *   - a positive amount
     *   - an amount matching baseAmount
     *
     * The transaction reference must also point to an
     * existing active user_rank_purchases record.
     *
     * This prevents commission calculations from being
     * based on arbitrary transaction IDs or amounts.
     */
    const source = await client.query(
      `
      SELECT
        t.id,
        t.user_id,
        t.amount,
        t.type,
        t.status,
        urp.id AS rank_purchase_id,
        urp.rank_id,
        urp.purchase_price,
        urp.status AS rank_purchase_status
      FROM transactions t
      JOIN user_rank_purchases urp
        ON t.reference = 'RANK-' || urp.id::text
       AND urp.user_id = t.user_id
      WHERE
        t.id = $1
        AND t.user_id = $2
        AND t.type = 'rank_purchase'
        AND t.status = 'successful'
        AND t.amount > 0
        AND urp.status = 'active'
      FOR UPDATE OF t, urp
      `,
      [
        sourceTransactionId,
        sourceUserId,
      ]
    );

    if (!source.rowCount) {
      throw new Error(
        "Invalid commission source transaction."
      );
    }

    const sourceTransaction =
      source.rows[0];

    const transactionAmount =
      Number(sourceTransaction.amount);

    const purchasePrice =
      Number(sourceTransaction.purchase_price);

    /*
     * The transaction amount, rank-purchase price and
     * commission base must all agree.
     */
    if (
      !Number.isFinite(transactionAmount) ||
      !Number.isFinite(purchasePrice) ||
      transactionAmount <= 0 ||
      purchasePrice <= 0
    ) {
      throw new Error(
        "Invalid rank-purchase source amount."
      );
    }

    if (
      Math.abs(
        transactionAmount -
        purchasePrice
      ) > 0.000001
    ) {
      throw new Error(
        "Rank-purchase transaction amount mismatch."
      );
    }

    if (
      Math.abs(
        transactionAmount -
        requestedBaseAmount
      ) > 0.000001
    ) {
      throw new Error(
        "Commission base amount mismatch."
      );
    }

    /*
     * Load active commission rules.
     *
     * The live configuration is currently:
     * Level 1 = 8%
     * Level 2 = 2%
     * Level 3 = 1%
     */
    const rules = await client.query(
      `
      SELECT
        level_number,
        percentage
      FROM commission_rules
      WHERE
        active = TRUE
        AND level_number BETWEEN 1 AND 3
      ORDER BY level_number
      `
    );

    const percentages = new Map();

    for (const row of rules.rows) {
      const level =
        Number(row.level_number);

      const percentage =
        Number(row.percentage);

      if (
        !Number.isInteger(level) ||
        level < 1 ||
        level > 3 ||
        !Number.isFinite(percentage) ||
        percentage < 0
      ) {
        throw new Error(
          "Invalid commission rule configuration."
        );
      }

      percentages.set(
        level,
        percentage
      );
    }

    /*
     * If a level has no active rule, the chain stops
     * at that level rather than inventing a percentage.
     */
    let currentUserId =
      sourceUserId;

    /*
     * Protect against malformed/cyclic referral graphs.
     *
     * The source user is already visited. A sponsor may
     * never point back to a previously visited account.
     */
    const visited = new Set([
      String(sourceUserId),
    ]);

    for (
      let level = 1;
      level <= 3;
      level++
    ) {
      const parent =
        await client.query(
          `
          SELECT
            dr.sponsor_user_id,
            dr.qualifying_status,
            u.role,
            u.enabled
          FROM direct_referrals dr
          JOIN users u
            ON u.id = dr.sponsor_user_id
          WHERE
            dr.referred_user_id = $1
            AND u.role = 'user'
            AND u.enabled = TRUE
          LIMIT 1
          FOR UPDATE OF dr, u
          `,
          [currentUserId]
        );

      if (!parent.rowCount) {
        break;
      }

      const sponsorId =
        parent.rows[0].sponsor_user_id;

      /*
       * Only a qualifying direct-referral relationship
       * can pass commission eligibility to the next hop.
       */
      const qualifying =
        parent.rows[0]
          .qualifying_status ===
        "starter_qualified";

      if (!qualifying) {
        break;
      }

      /*
       * Never pay the source user or any already-visited
       * account. This also protects against referral cycles.
       */
      if (
        visited.has(
          String(sponsorId)
        )
      ) {
        throw new Error(
          "Invalid referral commission chain."
        );
      }

      visited.add(
        String(sponsorId)
      );

      const percentage =
        percentages.get(level) ?? 0;

      if (percentage <= 0) {
        break;
      }

      const commission =
        Math.round(
          requestedBaseAmount *
          percentage
        ) / 100;

      if (
        !Number.isFinite(commission) ||
        commission <= 0
      ) {
        currentUserId =
          sponsorId;
        continue;
      }

      /*
       * Idempotency protection.
       *
       * The database UNIQUE constraint is the final
       * protection against duplicate credits:
       *
       * beneficiary_user_id +
       * source_transaction_id +
       * level_number
       */
      const inserted =
        await client.query(
          `
          INSERT INTO commission_ledger
            (
              beneficiary_user_id,
              source_user_id,
              source_transaction_id,
              level_number,
              percentage,
              base_amount,
              commission_amount,
              status
            )
          VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              'credited'
            )
          ON CONFLICT
            (
              beneficiary_user_id,
              source_transaction_id,
              level_number
            )
          DO NOTHING
          RETURNING id
          `,
          [
            sponsorId,
            sourceUserId,
            sourceTransactionId,
            level,
            percentage,
            requestedBaseAmount,
            commission,
          ]
        );

      /*
       * If the ledger row already exists, the commission
       * has already been credited. Do not credit the wallet
       * or create another transaction.
       */
      if (inserted.rowCount) {
        const walletUpdate =
          await client.query(
            `
            UPDATE wallets
            SET
              available_balance =
                available_balance + $1,
              updated_at = NOW()
            WHERE
              user_id = $2
            `,
            [
              commission,
              sponsorId,
            ]
          );

        if (walletUpdate.rowCount !== 1) {
          throw new Error(
            "Commission beneficiary wallet not found."
          );
        }

        const tx =
          await client.query(
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
                'referral_bonus',
                $2,
                0,
                'successful',
                $3,
                $4
              )
            RETURNING id
            `,
            [
              sponsorId,
              commission,
              `REF-${inserted.rows[0].id}`,
              JSON.stringify({
                sourceUserId,
                sourceTransactionId,
                sourceRankPurchaseId:
                  sourceTransaction.rank_purchase_id,
                sourceRankId:
                  sourceTransaction.rank_id,
                level,
                percentage,
              }),
            ]
          );

        if (!tx.rowCount) {
          throw new Error(
            "Unable to record referral commission transaction."
          );
        }

        const balance =
          await client.query(
            `
            SELECT
              available_balance
            FROM wallets
            WHERE user_id = $1
            FOR UPDATE
            `,
            [sponsorId]
          );

        if (!balance.rowCount) {
          throw new Error(
            "Commission beneficiary wallet not found."
          );
        }

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
              'referral_bonus',
              $3,
              $4,
              $5
            )
          `,
          [
            sponsorId,
            tx.rows[0].id,
            commission,
            balance.rows[0]
              .available_balance,
            `Referral commission level ${level}`,
          ]
        );
      }

      /*
       * The sponsor becomes the next source node for
       * the following referral level.
       */
      currentUserId =
        sponsorId;
    }

    await client.query("COMMIT");

    return {
      ok: true,
    };

  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    throw error;

  } finally {
    client.release();
  }
}
