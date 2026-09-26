import { getDb } from "./db.js";

function normalizeAmount(value) {
  const text = String(value ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error("Enter a valid deposit amount.");
  }

  const amount = Number(text);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid deposit amount.");
  }

  return Math.round(amount * 100) / 100;
}

export async function createDepositOrder(userId, amount) {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const amountNumber = normalizeAmount(amount);

    const userQ = await client.query(
      `
      SELECT id, phone
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (!userQ.rowCount) {
      throw new Error("User not found.");
    }

    const phone = String(userQ.rows[0].phone || "").replace(/\D/g, "");

    if (phone.length < 3) {
      throw new Error("A valid registered phone number is required.");
    }

    /*
      Do not allow one user to reserve multiple cashier accounts
      at the same time.
    */
    const existingQ = await client.query(
      `
      SELECT id, status
      FROM deposit_orders
      WHERE user_id = $1
        AND status IN ('awaiting_payment', 'payment_submitted')
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );

    if (existingQ.rowCount) {
      throw new Error(
        "You already have a pending deposit. Complete or wait for that deposit first."
      );
    }

    /*
      The first 3 digits of the registered user phone determine
      the payment network through the Admin-configured prefix table.
    */
    const prefix = phone.slice(0, 3);

    const networkQ = await client.query(
      `
      SELECT network
      FROM network_prefixes
      WHERE prefix = $1
        AND active = TRUE
      LIMIT 1
      `,
      [prefix]
    );

    if (!networkQ.rowCount) {
      throw new Error(
        `Your phone prefix ${prefix} is not currently configured for deposits.`
      );
    }

    const userNetwork = String(networkQ.rows[0].network).trim();

    /*
      Reserve one Admin-configured payment wallet.

      Rules:
      - account must be active
      - account must not already be in use
      - amount must be within min/max
      - payment network must match detected user network
      - oldest last-assigned account is preferred
      - SKIP LOCKED prevents two simultaneous users from taking
        the same account
    */
    const walletQ = await client.query(
      `
      SELECT
        p.id,
        p.network_id,
        p.account_number,
        p.recipient_name,
        p.min_amount,
        p.max_amount,
        pn.name AS payment_network
      FROM payment_wallet_pool p
      INNER JOIN payment_networks pn
        ON pn.id = p.network_id
      WHERE p.active = TRUE
        AND p.in_use = FALSE
        AND p.min_amount <= $1
        AND (p.max_amount IS NULL OR p.max_amount >= $1)
        AND UPPER(pn.name) = UPPER($2)
      ORDER BY
        p.last_assigned_at NULLS FIRST,
        p.account_number
      LIMIT 1
      FOR UPDATE SKIP LOCKED
      `,
      [amountNumber, userNetwork]
    );

    if (!walletQ.rowCount) {
      throw new Error(
        `No payment account is currently available for ${userNetwork} at this amount.`
      );
    }

    const wallet = walletQ.rows[0];

    /*
      Reserve the wallet until Admin verifies or rejects
      the deposit.
    */
    await client.query(
      `
      UPDATE payment_wallet_pool
      SET
        in_use = TRUE,
        last_assigned_at = NOW()
      WHERE id = $1
      `,
      [wallet.id]
    );

    const orderQ = await client.query(
      `
      INSERT INTO deposit_orders(
        user_id,
        amount,
        network_id,
        wallet_id,
        status
      )
      VALUES(
        $1,
        $2,
        $3,
        $4,
        'awaiting_payment'
      )
      RETURNING
        id,
        amount,
        status,
        created_at,
        network_id,
        wallet_id
      `,
      [
        userId,
        amountNumber,
        wallet.network_id,
        wallet.id
      ]
    );

    if (!orderQ.rowCount) {
      throw new Error("Unable to create deposit order.");
    }

    await client.query("COMMIT");

    return {
      order: orderQ.rows[0],
      network: userNetwork,
      paymentNetwork: wallet.payment_network,
      accountNumber: wallet.account_number,
      recipientName: wallet.recipient_name
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function submitDepositPayment(userId, orderId) {
  if (!orderId) {
    throw new Error("Deposit order id is required.");
  }

  const db = getDb();

  const existing = await db.query(
    `
    SELECT *
    FROM deposit_orders
    WHERE id = $1
      AND user_id = $2
    LIMIT 1
    `,
    [orderId, userId]
  );

  if (!existing.rowCount) {
    throw new Error("Deposit order not found.");
  }

  const current = existing.rows[0];

  /*
    Make the operation idempotent.
    If the user presses the button twice, we don't create
    another submission or another transaction.
  */
  if (current.status === "payment_submitted") {
    return current;
  }

  if (current.status !== "awaiting_payment") {
    throw new Error("This deposit cannot be submitted.");
  }

  const result = await db.query(
    `
    UPDATE deposit_orders
    SET
      status = 'payment_submitted',
      payment_submitted_at = NOW()
    WHERE id = $1
      AND user_id = $2
      AND status = 'awaiting_payment'
    RETURNING *
    `,
    [orderId, userId]
  );

  if (!result.rowCount) {
    throw new Error("Deposit order cannot be submitted.");
  }

  return result.rows[0];
}
