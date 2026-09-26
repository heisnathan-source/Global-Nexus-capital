import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";
import { getWithdrawalPolicy } from "@/lib/withdrawal-policy.js";

function session(request) {
  const c = request.headers.get("cookie") || "";

  const m = c.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const s = m
    ? verifySessionToken(m[1])
    : null;

  return s && s.role === "user"
    ? s
    : null;
}

function feeFor(amount, policy) {
  if (policy.feeMode === "fixed") {
    return Math.max(
      0,
      policy.feeValue
    );
  }

  return Math.max(
    0,
    amount * policy.feeValue / 100
  );
}

function publicWithdrawalError(error) {
  const message = String(error?.message || "");

  const allowed = new Set([
    "User account not found.",
    "Invalid Funds Password.",
    "Only one withdrawal request is allowed within 24 hours.",
    "This withdrawal amount is not currently available.",
    "Withdrawal amount after fee must be greater than zero.",
    "User wallet not found.",
    "Insufficient available balance."
  ]);

  return allowed.has(message)
    ? message
    : "Could not create withdrawal.";
}


export async function POST(request) {

  const s = session(request);

  if (!s) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }


  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }


  const {
    amount,
    fundsPassword
  } = body;


  const value = Number(amount);


  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return Response.json(
      {
        error:
          "Enter a valid withdrawal amount."
      },
      { status: 400 }
    );
  }


  if (
    !/^\d{6}$/.test(
      String(fundsPassword || "")
    )
  ) {
    return Response.json(
      {
        error:
          "Funds Password must contain exactly 6 numbers."
      },
      { status: 400 }
    );
  }


  const policy =
    await getWithdrawalPolicy(
      s.userId
    );


  if (!policy.allowed) {
    return Response.json(
      {
        error:
          policy.reason
      },
      { status: 403 }
    );
  }


  const db = getDb();

  const client =
    await db.connect();


  try {

    await client.query("BEGIN");


    /*
      Lock the user row.

      This also reads the admin-controlled
      withdrawal frequency exemption.
    */

    const userResult =
      await client.query(
        `
          SELECT
            enabled,
            funds_password_hash,
            withdrawal_frequency_exempt
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [s.userId]
      );


    if (!userResult.rowCount) {
      throw new Error(
        "User account not found."
      );
    }


    const user =
      userResult.rows[0];

    if (!user.enabled) {
      throw new Error(
        "Account is currently disabled."
      );
    }


    /*
      Verify funds password.
    */

    if (
      !user.funds_password_hash ||
      !(
        await bcrypt.compare(
          String(fundsPassword),
          user.funds_password_hash
        )
      )
    ) {
      throw new Error(
        "Invalid Funds Password."
      );
    }


    /*
      Normal users:
      Maximum one withdrawal every 24 hours.

      Admin-exempt users:
      Can submit multiple withdrawals.
    */

    const frequencyExempt =
      user.withdrawal_frequency_exempt === true;


    if (
      policy.onePer24Hours &&
      !frequencyExempt
    ) {

      const recent =
        await client.query(
          `
            SELECT id
            FROM withdrawal_orders
            WHERE user_id = $1
              AND created_at >=
                NOW() - INTERVAL '24 hours'
              AND status NOT IN (
                'rejected',
                'cancelled'
              )
            LIMIT 1
          `,
          [s.userId]
        );


      if (recent.rowCount) {
        throw new Error(
          "Only one withdrawal request is allowed within 24 hours."
        );
      }

    }


    /*
      Check that the amount is one of the
      admin-approved withdrawal amounts.
    */

    const allowedAmount =
      await client.query(
        `
          SELECT 1
          FROM withdrawal_amounts
          WHERE active = TRUE
            AND amount = $1
          LIMIT 1
        `,
        [value]
      );


    if (!allowedAmount.rowCount) {
      throw new Error(
        "This withdrawal amount is not currently available."
      );
    }


    const fee =
      feeFor(value, policy);


    const net =
      value - fee;


    if (net <= 0) {
      throw new Error(
        "Withdrawal amount after fee must be greater than zero."
      );
    }


    /*
      Lock wallet.
    */

    const walletResult =
      await client.query(
        `
          SELECT
            available_balance,
            reserved_balance
          FROM wallets
          WHERE user_id = $1
          FOR UPDATE
        `,
        [s.userId]
      );


    if (!walletResult.rowCount) {
      throw new Error(
        "User wallet not found."
      );
    }


    const wallet =
      walletResult.rows[0];


    const availableBalance =
      Number(
        wallet.available_balance || 0
      );


    if (availableBalance < value) {
      throw new Error(
        "Insufficient available balance."
      );
    }


    /*
      Calculate earliest processing time.
    */

    const scheduled =
      new Date(
        Date.now() +
        Number(
          policy.processingMinHours || 0
        ) *
        60 *
        60 *
        1000
      );


    /*
      Reserve withdrawal funds immediately.
    */

    const balanceAfter =
      availableBalance - value;


    await client.query(
      `
        UPDATE wallets
        SET
          available_balance = $1,
          reserved_balance =
            reserved_balance + $2,
          updated_at = NOW()
        WHERE user_id = $3
      `,
      [
        balanceAfter,
        value,
        s.userId
      ]
    );


    /*
      Create withdrawal order.
    */

    const orderResult =
      await client.query(
        `
          INSERT INTO withdrawal_orders
            (
              user_id,
              gross_amount,
              fee_amount,
              net_amount,
              status,
              scheduled_at
            )
          VALUES
            (
              $1,
              $2,
              $3,
              $4,
              'pending',
              $5
            )
          RETURNING *
        `,
        [
          s.userId,
          value,
          fee,
          net,
          scheduled
        ]
      );


    const order =
      orderResult.rows[0];


    /*
      Create transaction record.
    */

    const transactionResult =
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
              'withdrawal',
              $2,
              $3,
              'pending',
              $4,
              $5
            )
          RETURNING id
        `,
        [
          s.userId,
          value,
          fee,
          `WD-${order.id}`,
          JSON.stringify({
            withdrawalOrderId:
              order.id,

            netAmount:
              net
          })
        ]
      );


    /*
      Record wallet ledger.
    */

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
            'withdrawal_hold',
            $3,
            $4,
            'Withdrawal amount reserved'
          )
      `,
      [
        s.userId,
        transactionResult.rows[0].id,
        -value,
        balanceAfter
      ]
    );


    await client.query(
      "COMMIT"
    );


    return Response.json(
      {
        order,
        fee,
        netAmount: net,
        balanceAfter,
        frequencyExempt
      },
      { status: 201 }
    );


  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    console.error(
      "Withdrawal creation error:",
      error
    );

    return Response.json(
      {
        error:
          publicWithdrawalError(error)
      },
      { status: 400 }
    );


  } finally {

    client.release();

  }

}
