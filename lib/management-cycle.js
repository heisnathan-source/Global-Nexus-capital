import { getDb } from "./db.js";

/*
  Management salary cycle evaluator.

  Rules:
  - Position configuration is authoritative.
  - Payments 1 and 2 require normal position qualification.
  - From payment 3 onward, qualifying direct members must have increased
    compared with the previous paid cycle.
  - Failure terminates the management contract.
  - Termination never removes the user's rank.
  - PostgreSQL performs the actual payment atomically and idempotently.
*/

export async function evaluateManagementContract(contractId) {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT
        mc.*,
        mp.name AS position_name,
        mp.required_direct_members,
        mp.required_qualifying_members,
        mp.salary_amount,
        mp.payment_interval_months,
        mp.active AS position_active,
        u.name AS user_name,
        u.account_id,
        u.phone
      FROM management_contracts mc
      JOIN management_positions mp
        ON mp.id = mc.position_id
      JOIN users u
        ON u.id = mc.user_id
      WHERE mc.id = $1
      FOR UPDATE OF mc
      `,
      [contractId]
    );

    if (!result.rowCount) {
      throw new Error("Management contract not found");
    }

    const contract = result.rows[0];

    if (contract.status !== "active") {
      await client.query("COMMIT");

      return {
        status: contract.status,
        contract
      };
    }

    if (contract.position_active !== true) {
      await client.query(
        `
        UPDATE management_contracts
        SET status = 'terminated',
            terminated_at = NOW(),
            qualification_snapshot_at = NOW()
        WHERE id = $1
          AND status = 'active'
        `,
        [contractId]
      );

      await client.query("COMMIT");

      return {
        status: "terminated",
        reason: "Management position is inactive"
      };
    }

    const countResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM direct_referrals dr
      JOIN users u
        ON u.id = dr.referred_user_id
      WHERE dr.sponsor_user_id = $1
        AND dr.qualifying_status = 'starter_qualified'
        AND u.role = 'user'
        AND u.enabled = TRUE
      `,
      [contract.user_id]
    );

    const currentCount = Number(
      countResult.rows[0]?.count || 0
    );

    const required = Math.max(
      Number(contract.required_direct_members || 0),
      Number(contract.required_qualifying_members || 0)
    );

    const nextCycle =
      Number(contract.payments_received || 0) + 1;

    /*
      The user must still satisfy the position's qualification
      before any salary payment can be processed.
    */
    if (currentCount < required) {
      if (nextCycle >= 3) {
        await client.query(
          `
          UPDATE management_contracts
          SET status = 'terminated',
              terminated_at = NOW(),
              qualifying_member_count = $1,
              qualification_snapshot_at = NOW()
          WHERE id = $2
            AND status = 'active'
          `,
          [currentCount, contractId]
        );

        await client.query(
          `
          UPDATE management_payments
          SET status = 'skipped'
          WHERE contract_id = $1
            AND cycle_number = $2
            AND status = 'pending'
          `,
          [contractId, nextCycle]
        );

        await client.query("COMMIT");

        return {
          status: "terminated",
          reason:
            "Continuing qualifying-member requirement not met",
          currentCount,
          required,
          nextCycle
        };
      }

      await client.query(
        `
        UPDATE management_contracts
        SET qualifying_member_count = $1,
            qualification_snapshot_at = NOW()
        WHERE id = $2
        `,
        [currentCount, contractId]
      );

      await client.query("COMMIT");

      return {
        status: "not_ready",
        currentCount,
        required,
        nextCycle
      };
    }

    /*
      From payment 3 onward the team must have grown.
    */
    if (
      nextCycle >= 3 &&
      currentCount <= Number(contract.last_member_count || 0)
    ) {
      await client.query(
        `
        UPDATE management_contracts
        SET status = 'terminated',
            terminated_at = NOW(),
            qualifying_member_count = $1,
            qualification_snapshot_at = NOW()
        WHERE id = $2
          AND status = 'active'
        `,
        [currentCount, contractId]
      );

      await client.query(
        `
        UPDATE management_payments
        SET status = 'skipped'
        WHERE contract_id = $1
          AND cycle_number = $2
          AND status = 'pending'
        `,
        [contractId, nextCycle]
      );

      await client.query("COMMIT");

      return {
        status: "terminated",
        reason:
          "No continued qualifying-member growth",
        currentCount,
        previousCount:
          Number(contract.last_member_count || 0),
        nextCycle
      };
    }

    /*
      Never create a duplicate payment for the same contract/cycle.
    */
    const existing = await client.query(
      `
      SELECT *
      FROM management_payments
      WHERE contract_id = $1
        AND cycle_number = $2
      FOR UPDATE
      `,
      [contractId, nextCycle]
    );

    let paymentId;

    if (existing.rowCount) {
      const existingPayment = existing.rows[0];

      if (existingPayment.status === "paid") {
        await client.query("COMMIT");

        return {
          status: "already_paid",
          payment: existingPayment,
          currentCount,
          required
        };
      }

      if (existingPayment.status === "skipped") {
        await client.query("COMMIT");

        return {
          status: "skipped",
          payment: existingPayment,
          currentCount,
          required
        };
      }

      /*
        An existing pending payment is safe to process immediately
        when its management contract is due.
      */
      paymentId = existingPayment.id;
    } else {
      /*
        IMPORTANT:
        The first payment must represent the payment that is due now.
        Do NOT add the payment interval here.

        The interval is applied by process_management_payment()
        after the payment succeeds, when it calculates the next
        next_payment_at.
      */
      const scheduledAt = contract.next_payment_at
        ? new Date(contract.next_payment_at)
        : new Date();

      const payment = await client.query(
        `
        INSERT INTO management_payments(
          contract_id,
          cycle_number,
          amount,
          status,
          scheduled_at
        )
        VALUES($1,$2,$3,'pending',$4)
        RETURNING id
        `,
        [
          contractId,
          nextCycle,
          Number(contract.salary_amount || 0),
          scheduledAt
        ]
      );

      paymentId = payment.rows[0].id;
    }

    await client.query("COMMIT");

    /*
      The database function handles wallet, transaction and ledger
      changes atomically and idempotently.
    */
    const processed = await db.query(
      `
      SELECT public.process_management_payment($1::uuid)
        AS transaction_id
      `,
      [paymentId]
    );

    const transactionId =
      processed.rows[0]?.transaction_id || null;

    if (!transactionId) {
      return {
        status: "not_paid",
        paymentId,
        currentCount,
        required,
        nextCycle
      };
    }

    return {
      status: "paid",
      paymentId,
      transactionId,
      currentCount,
      required,
      nextCycle
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function evaluateDueManagementContracts() {
  const db = getDb();

  const result = await db.query(
    `
    SELECT id
    FROM management_contracts
    WHERE status = 'active'
      AND (
        next_payment_at IS NULL
        OR next_payment_at <= NOW()
      )
    ORDER BY next_payment_at NULLS FIRST, id
    `
  );

  const results = [];

  for (const row of result.rows) {
    try {
      results.push(
        await evaluateManagementContract(row.id)
      );
    } catch (error) {
      console.error(
        "Management contract evaluation failed:",
        row.id,
        error
      );

      results.push({
        status: "error",
        contractId: row.id
      });
    }
  }

  return results;
}
