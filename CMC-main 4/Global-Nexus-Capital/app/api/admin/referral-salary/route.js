import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

import {
  evaluateDueManagementContracts
} from "@/lib/management-cycle.js";

function adminSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  if (!match) return null;

  const session = verifySessionToken(match[1]);

  return session && session.role === "admin"
    ? session
    : null;
}

export async function GET(request) {
  const session = adminSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { getDb } = await import("@/lib/db.js");

    const db = getDb();

    const contractsResult = await db.query(`
      SELECT
        mc.id,
        mc.user_id,
        u.name AS user_name,
        u.phone,
        u.account_id,
        mp.id AS position_id,
        mp.name AS position_name,
        mp.required_direct_members,
        mp.required_qualifying_members,
        mp.salary_amount,
        mp.payment_interval_months,
        mc.status,
        mc.qualifying_member_count,
        mc.payments_received,
        mc.last_member_count,
        mc.started_at,
        mc.next_payment_at,
        mc.terminated_at,
        mc.qualification_snapshot_at,

        COALESCE(
          (
            SELECT SUM(p.amount)
            FROM management_payments p
            WHERE p.contract_id = mc.id
              AND p.status = 'paid'
          ),
          0
        ) AS total_paid,

        (
          SELECT COUNT(*)
          FROM management_payments p
          WHERE p.contract_id = mc.id
        ) AS payment_count

      FROM management_contracts mc

      JOIN users u
        ON u.id = mc.user_id

      JOIN management_positions mp
        ON mp.id = mc.position_id

      ORDER BY
        CASE
          WHEN mc.status = 'active' THEN 0
          ELSE 1
        END,
        mc.next_payment_at NULLS LAST,
        u.name ASC
    `);

    const paymentsResult = await db.query(`
      SELECT
        p.id,
        p.contract_id,
        p.cycle_number,
        p.amount,
        p.status,
        p.scheduled_at,
        p.paid_at,

        mc.user_id,

        u.name AS user_name,
        u.phone,
        u.account_id,

        mp.name AS position_name,

        t.id AS transaction_id,
        t.status AS transaction_status,
        t.reference AS transaction_reference,
        t.created_at AS transaction_created_at

      FROM management_payments p

      JOIN management_contracts mc
        ON mc.id = p.contract_id

      JOIN users u
        ON u.id = mc.user_id

      JOIN management_positions mp
        ON mp.id = mc.position_id

      LEFT JOIN transactions t
        ON t.reference = 'MANAGEMENT-' || p.id::text

      ORDER BY
        p.scheduled_at DESC NULLS LAST,
        p.cycle_number DESC
    `);

    const contracts = contractsResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      phone: row.phone,
      accountId: row.account_id,
      positionId: row.position_id,
      positionName: row.position_name,
      requiredDirectMembers: Number(
        row.required_direct_members || 0
      ),
      requiredQualifyingMembers: Number(
        row.required_qualifying_members || 0
      ),
      requiredMembers: Math.max(
        Number(row.required_direct_members || 0),
        Number(row.required_qualifying_members || 0)
      ),
      salaryAmount: Number(
        row.salary_amount || 0
      ),
      paymentIntervalMonths: Number(
        row.payment_interval_months || 0
      ),
      status: row.status,
      qualifyingMemberCount: Number(
        row.qualifying_member_count || 0
      ),
      paymentsReceived: Number(
        row.payments_received || 0
      ),
      lastMemberCount: Number(
        row.last_member_count || 0
      ),
      startedAt: row.started_at,
      nextPaymentAt: row.next_payment_at,
      terminatedAt: row.terminated_at,
      qualificationSnapshotAt:
        row.qualification_snapshot_at,
      totalPaid: Number(
        row.total_paid || 0
      ),
      paymentCount: Number(
        row.payment_count || 0
      )
    }));

    const payments = paymentsResult.rows.map((row) => ({
      id: row.id,
      contractId: row.contract_id,
      userId: row.user_id,
      userName: row.user_name,
      phone: row.phone,
      accountId: row.account_id,
      positionName: row.position_name,
      cycleNumber: Number(
        row.cycle_number || 0
      ),
      amount: Number(
        row.amount || 0
      ),
      status: row.status,
      scheduledAt: row.scheduled_at,
      paidAt: row.paid_at,
      transactionId: row.transaction_id,
      transactionStatus:
        row.transaction_status,
      transactionReference:
        row.transaction_reference,
      transactionCreatedAt:
        row.transaction_created_at
    }));

    const summary = {
      totalContracts: contracts.length,

      activeContracts: contracts.filter(
        (item) => item.status === "active"
      ).length,

      terminatedContracts: contracts.filter(
        (item) => item.status === "terminated"
      ).length,

      totalPayments: payments.length,

      paidPayments: payments.filter(
        (item) => item.status === "paid"
      ).length,

      pendingPayments: payments.filter(
        (item) => item.status === "pending"
      ).length,

      skippedPayments: payments.filter(
        (item) => item.status === "skipped"
      ).length,

      totalPaid: contracts.reduce(
        (sum, item) =>
          sum + Number(item.totalPaid || 0),
        0
      )
    };

    return Response.json({
      ok: true,
      summary,
      contracts,
      payments
    });
  } catch (error) {
    console.error(
      "GET /api/admin/referral-salary:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load management salary data."
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = adminSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const results =
      await evaluateDueManagementContracts();

    return Response.json({
      ok: true,
      results: Array.isArray(results)
        ? results
        : []
    });
  } catch (error) {
    console.error(
      "POST /api/admin/referral-salary:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to evaluate management salaries."
      },
      { status: 500 }
    );
  }
}
