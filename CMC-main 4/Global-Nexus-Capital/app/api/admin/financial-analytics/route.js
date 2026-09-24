import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

function adminSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session && session.role === "admin"
    ? session
    : null;
}

function getPeriodStart(period) {
  const now = new Date();

  if (period === "daily") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "weekly") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;

    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);

    return start;
  }

  if (period === "monthly") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );
  }

  if (period === "yearly") {
    return new Date(
      now.getFullYear(),
      0,
      1
    );
  }

  return null;
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
    const url = new URL(request.url);

    const period =
      url.searchParams.get("period") || "daily";

    const allowedPeriods = [
      "daily",
      "weekly",
      "monthly",
      "yearly"
    ];

    if (!allowedPeriods.includes(period)) {
      return Response.json(
        { error: "Invalid period." },
        { status: 400 }
      );
    }

    const start = getPeriodStart(period);

    const db = getDb();

    const result = await db.query(
      `
      SELECT
        type,
        amount,
        fee,
        status,
        metadata,
        created_at
      FROM transactions
      WHERE created_at >= $1
        AND status IN ('successful', 'completed')
      ORDER BY created_at DESC
      `,
      [start]
    );

    let deposits = 0;
    let withdrawals = 0;

    const breakdown = {};

    for (const transaction of result.rows) {
      const type = transaction.type;
      const amount = Number(transaction.amount || 0);

      if (!breakdown[type]) {
        breakdown[type] = {
          type,
          total: 0,
          count: 0
        };
      }

      breakdown[type].total += amount;
      breakdown[type].count += 1;

      if (type === "deposit") {
        deposits += amount;
      }

      if (type === "withdrawal") {
        withdrawals += amount;
      }
    }

    const externalCashPosition =
      deposits - withdrawals;

    const internalResult = await db.query(
      `
      SELECT
        entry_type,
        amount,
        description,
        created_at
      FROM wallet_ledger
      WHERE created_at >= $1
      ORDER BY created_at DESC
      `,
      [start]
    );

    let internalCredits = 0;
    let internalDebits = 0;

    for (const entry of internalResult.rows) {
      const amount = Number(entry.amount || 0);

      /*
       * Deposits and withdrawal holds are external
       * cash-flow events and are not counted here.
       */
      if (
        entry.entry_type === "deposit" ||
        entry.entry_type === "withdrawal_hold"
      ) {
        continue;
      }

      if (amount > 0) {
        internalCredits += amount;
      }

      if (amount < 0) {
        internalDebits += Math.abs(amount);
      }
    }

    const netInternalWalletMovement =
      internalDebits - internalCredits;

    const overallOperationalPosition =
      externalCashPosition +
      netInternalWalletMovement;

    let positionStatus = "balanced";

    if (overallOperationalPosition > 0) {
      positionStatus = "increased";
    }

    if (overallOperationalPosition < 0) {
      positionStatus = "decreased";
    }

    const depositVsWithdrawalDifference =
      Math.abs(externalCashPosition);

    let cashFlowStatus = "balanced";

    if (externalCashPosition > 0) {
      cashFlowStatus = "more_entering";
    }

    if (externalCashPosition < 0) {
      cashFlowStatus = "more_leaving";
    }

    return Response.json({
      period,

      summary: {
        moneyEntered: deposits,
        moneyLeft: withdrawals,

        externalCashPosition,

        internalCredits,
        internalDebits,

        netInternalWalletMovement,

        overallOperationalPosition,

        positionStatus,

        cashFlowStatus,

        depositVsWithdrawalDifference
      },

      transactionCount:
        result.rows.length,

      breakdown:
        Object.values(breakdown)
          .sort((a, b) =>
            b.total - a.total
          )
    });

  } catch (error) {

    console.error(
      "FINANCIAL ANALYTICS ERROR:",
      error
    );

    return Response.json(
      {
        error: "Unable to load financial analytics."
      },
      { status: 500 }
    );
  }
}
