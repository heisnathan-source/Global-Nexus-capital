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

function normalizePaymentSenderName(value) {
  const name = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

  if (!name) {
    throw new Error(
      "Enter the name on the payment account."
    );
  }

  if (name.length < 2) {
    throw new Error(
      "Enter a valid payment account name."
    );
  }

  if (name.length > 120) {
    throw new Error(
      "Payment account name is too long."
    );
  }

  return name;
}

export async function createDepositOrder(
  userId,
  amount,
  suppliedPaymentPhone,
  suppliedPaymentSenderName
) {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const amountNumber = normalizeAmount(amount);

    const paymentPhone =
      String(suppliedPaymentPhone ?? "").trim();

    const paymentDigits =
      paymentPhone.replace(/\D/g, "");

    if (paymentDigits.length < 3) {
      throw new Error(
        "Enter a valid payment phone number."
      );
    }

    const paymentSenderName =
      normalizePaymentSenderName(
        suppliedPaymentSenderName
      );

    const userQ = await client.query(
      `
      SELECT
        id,
        phone,
        enabled
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (!userQ.rowCount) {
      throw new Error("User not found.");
    }

    if (!userQ.rows[0].enabled) {
      throw new Error("Account is currently disabled.");
    }

    let normalizedPaymentPhone = paymentDigits;

    if (
      normalizedPaymentPhone.startsWith("233") &&
      normalizedPaymentPhone.length >= 12
    ) {
      normalizedPaymentPhone =
        "0" + normalizedPaymentPhone.slice(3);
    }

    if (normalizedPaymentPhone.length < 3) {
      throw new Error(
        "Enter a valid payment phone number."
      );
    }

    const prefix =
      normalizedPaymentPhone.slice(0, 3);

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
        `The payment phone prefix ${prefix} is not currently configured for deposits.`
      );
    }

    const userNetwork = String(
      networkQ.rows[0].network
    )
      .trim()
      .toUpperCase();

    let paymentNetwork;

    /*
     * Global Nexus Capital cross-network payment routing:
     *
     * MTN       -> TELECEL
     * TELECEL   -> MTN
     * AIRTELTIGO -> TELECEL
     */
    if (userNetwork === "MTN") {
      paymentNetwork = "TELECEL";
    } else if (userNetwork === "TELECEL") {
      paymentNetwork = "MTN";
    } else if (userNetwork === "AIRTELTIGO") {
      paymentNetwork = "TELECEL";
    } else {
      throw new Error(
        `No payment route is configured for ${userNetwork}.`
      );
    }

    /*
     * The selected payment account is locked during
     * the transaction so two deposits cannot select
     * the same account simultaneously.
     *
     * assigned_staff_id is copied into the deposit order
     * as a permanent historical snapshot.
     */
    const walletQ = await client.query(
      `
      SELECT
        p.id,
        p.account_number,
        p.recipient_name,
        p.min_amount,
        p.max_amount,
        p.network_id,
        p.assigned_staff_id,
        pn.name AS payment_network
      FROM payment_wallet_pool p
      INNER JOIN payment_networks pn
        ON pn.id = p.network_id
      WHERE p.active = TRUE
      AND UPPER(pn.name) = UPPER($1)
      AND p.min_amount <= $2
      AND (
        p.max_amount IS NULL
        OR p.max_amount >= $2
      )
      ORDER BY
        p.last_assigned_at NULLS FIRST,
        p.account_number
      LIMIT 1
      FOR UPDATE SKIP LOCKED
      `,
      [paymentNetwork, amountNumber]
    );

    if (!walletQ.rowCount) {
      throw new Error(
        `No payment account is currently available for ${paymentNetwork} at this amount.`
      );
    }

    const wallet = walletQ.rows[0];

    await client.query(
      `
      UPDATE payment_wallet_pool
      SET
        last_assigned_at = NOW()
      WHERE id = $1
      `,
      [wallet.id]
    );

    const networkId = wallet.network_id;

    const orderQ = await client.query(
      `
      INSERT INTO deposit_orders(
        user_id,
        amount,
        network_id,
        wallet_id,
        assigned_staff_id,
        payment_phone,
        payment_sender_name,
        status
      )
      VALUES(
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        'awaiting_payment'
      )
      RETURNING
        id,
        amount,
        status,
        created_at,
        network_id,
        wallet_id,
        assigned_staff_id,
        payment_phone,
        payment_sender_name
      `,
      [
        userId,
        amountNumber,
        networkId,
        wallet.id,
        wallet.assigned_staff_id || null,
        normalizedPaymentPhone,
        paymentSenderName
      ]
    );

    if (!orderQ.rowCount) {
      throw new Error(
        "Unable to create deposit order."
      );
    }

    await client.query("COMMIT");

    return {
      order: {
        ...orderQ.rows[0],
        accountNumber:
          wallet.account_number,
        account_number:
          wallet.account_number,
        paymentNumber:
          wallet.account_number,
        payment_number:
          wallet.account_number,
        recipientName:
          wallet.recipient_name,
        recipient_name:
          wallet.recipient_name,
        paymentNetwork:
          wallet.payment_network,
        payment_network:
          wallet.payment_network
      },
      network: userNetwork,
      paymentNetwork:
        wallet.payment_network,
      accountNumber:
        wallet.account_number,
      account_number:
        wallet.account_number,
      paymentNumber:
        wallet.account_number,
      payment_number:
        wallet.account_number,
      recipientName:
        wallet.recipient_name,
      recipient_name:
        wallet.recipient_name
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function submitDepositPayment(
  userId,
  orderId

) {
  if (!orderId) {
    throw new Error(
      "Deposit order id is required."
    );
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
    throw new Error(
      "Deposit order not found."
    );
  }

  const current = existing.rows[0];

  if (
    current.status ===
    "payment_submitted"
  ) {
    return current;
  }

  if (
    current.status !==
    "awaiting_payment"
  ) {
    throw new Error(
      "This deposit cannot be submitted."
    );
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
    throw new Error(
      "Deposit order cannot be submitted."
    );
  }

  return result.rows[0];
}
