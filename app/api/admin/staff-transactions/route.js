import { NextResponse } from "next/server";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
  VERIFICATION_COOKIE_NAME,
} from "@/lib/session.js";
import { getDb } from "@/lib/db.js";

export const dynamic = "force-dynamic";

function getCookie(request, name) {
  const cookieHeader =
    request.headers.get("cookie") || "";

  const parts =
    cookieHeader.split(";");

  for (const part of parts) {
    const trimmed =
      part.trim();

    if (
      trimmed.startsWith(
        `${name}=`
      )
    ) {
      return trimmed.slice(
        name.length + 1
      );
    }
  }

  return null;
}

async function getSession(request) {
  const adminToken =
    getCookie(
      request,
      ADMIN_COOKIE_NAME
    );

  const verificationToken =
    getCookie(
      request,
      VERIFICATION_COOKIE_NAME
    );

  let session = null;

  if (adminToken) {
    session =
      verifySessionToken(
        adminToken
      );
  }

  if (
    !session &&
    verificationToken
  ) {
    session =
      verifySessionToken(
        verificationToken
      );
  }

  if (
    !session ||
    !session.userId
  ) {
    return null;
  }

  if (
    session.role !== "admin" &&
    session.role !==
      "verification_staff"
  ) {
    return null;
  }

  const db = getDb();

  const result =
    await db.query(
      `
      SELECT
        u.id,
        u.name,
        u.role,
        u.enabled,
        u.staff_report_exclusion_enabled
      FROM users u
      WHERE u.id = $1
        AND u.enabled = true
      LIMIT 1
      `,
      [session.userId]
    );

  if (!result.rows[0]) {
    return null;
  }

  return {
    ...result.rows[0],
    userId:
      result.rows[0].id,
  };
}

function getPeriodStart(period) {
  const now =
    new Date();

  if (
    period === "week"
  ) {
    const d =
      new Date(now);

    const day =
      d.getUTCDay();

    const diff =
      day === 0
        ? 6
        : day - 1;

    d.setUTCDate(
      d.getUTCDate() -
        diff
    );

    d.setUTCHours(
      0,
      0,
      0,
      0
    );

    return d;
  }

  if (
    period === "month"
  ) {
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        1
      )
    );
  }

  if (
    period === "year"
  ) {
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        0,
        1
      )
    );
  }

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
  );
}

function money(value) {
  return Number(
    value || 0
  );
}

function buildSummary(
  deposits,
  withdrawals
) {
  const depositAmount =
    deposits.reduce(
      (sum, row) =>
        sum +
        money(row.amount),
      0
    );

  const withdrawalGross =
    withdrawals.reduce(
      (sum, row) =>
        sum +
        money(
          row.gross_amount
        ),
      0
    );

  const withdrawalFees =
    withdrawals.reduce(
      (sum, row) =>
        sum +
        money(
          row.fee_amount
        ),
      0
    );

  const withdrawalNet =
    withdrawals.reduce(
      (sum, row) =>
        sum +
        money(
          row.net_amount
        ),
      0
    );

  return {
    deposit_count:
      deposits.length,

    deposit_amount:
      Number(
        depositAmount.toFixed(
          2
        )
      ),

    withdrawal_count:
      withdrawals.length,

    withdrawal_gross:
      Number(
        withdrawalGross.toFixed(
          2
        )
      ),

    withdrawal_fees:
      Number(
        withdrawalFees.toFixed(
          2
        )
      ),

    withdrawal_net:
      Number(
        withdrawalNet.toFixed(
          2
        )
      ),

    record_count:
      deposits.length +
      withdrawals.length,
  };
}

export async function GET(request) {
  try {
    const session =
      await getSession(
        request
      );

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const {
      searchParams,
    } = new URL(
      request.url
    );

    const requestedPeriod =
      searchParams.get(
        "period"
      );

    const period = [
      "today",
      "week",
      "month",
      "year",
    ].includes(
      requestedPeriod
    )
      ? requestedPeriod
      : "today";

    const requestedStaffId =
      searchParams.get(
        "staffId"
      );

    const selectedStaffId =
      session.role === "admin" &&
      requestedStaffId
        ? requestedStaffId
        : null;

    /*
     * Deposit search is deliberately
     * limited to:
     *
     * 1. Deposit order ID
     * 2. Payment phone
     * 3. Payment sender name
     *
     * The member's registered Global Nexus Capital
     * account_id is NOT searched.
     */
    const search =
      String(
        searchParams.get(
          "search"
        ) || ""
      )
        .trim()
        .replace(/\s+/g, " ");

    const periodStart =
      getPeriodStart(
        period
      );

    const db = getDb();

    const staffResult =
      await db.query(`
        SELECT
          id,
          name,
          staff_login,
          enabled,
          staff_report_exclusion_enabled
        FROM users
        WHERE role =
          'verification_staff'
        ORDER BY
          name ASC,
          staff_login ASC
      `);

    /*
     * VERIFIED DEPOSITS
     */
    const depositParams =
      [periodStart];

    const depositConditions = [
      `d.verified_at IS NOT NULL`,
      `d.verified_at >= $1`,
    ];

    if (selectedStaffId) {
      depositParams.push(
        selectedStaffId
      );

      depositConditions.push(
        `d.assigned_staff_id = $${depositParams.length}`
      );
    }

    if (search) {
      depositParams.push(
        `%${search}%`
      );

      const searchParam =
        `$${depositParams.length}`;

      depositConditions.push(
        `(
          d.id::text ILIKE ${searchParam}
          OR COALESCE(
            d.payment_phone,
            ''
          ) ILIKE ${searchParam}
          OR COALESCE(
            d.payment_sender_name,
            ''
          ) ILIKE ${searchParam}
        )`
      );
    }

    const depositsResult =
      await db.query(
        `
          SELECT
            d.id,
            d.user_id,
            d.amount,
            d.status,
            d.staff_dashboard_status,
            d.created_at,
            d.verified_at,
            d.assigned_staff_id,
            d.payment_phone,
            d.payment_sender_name,

            u.name AS member_name,
            u.phone,
            u.phone_number,
            u.account_id,

            s.name AS staff_name,
            s.staff_login,
            s.staff_report_exclusion_enabled,

            p.account_number AS payment_account,
            n.name AS network_name,

            COALESCE(
              ex.excluded,
              false
            ) AS excluded_from_staff_reports,

            ex.reason AS exclusion_reason,
            ex.changed_by AS exclusion_changed_by,
            ex.updated_at AS exclusion_updated_at,

            cb.name AS exclusion_changed_by_name,
            cb.staff_login AS exclusion_changed_by_login

          FROM deposit_orders d

          LEFT JOIN users u
            ON u.id = d.user_id

          LEFT JOIN users s
            ON s.id =
              d.assigned_staff_id

          LEFT JOIN payment_wallet_pool p
            ON p.id = d.wallet_id

          LEFT JOIN payment_networks n
            ON n.id = p.network_id

          LEFT JOIN staff_report_exclusions ex
            ON ex.staff_id =
              d.assigned_staff_id
           AND ex.transaction_type =
              'deposit'
           AND ex.transaction_id =
              d.id

          LEFT JOIN users cb
            ON cb.id =
              ex.changed_by

          WHERE ${depositConditions.join(
            "\n            AND "
          )}

          ORDER BY
            d.verified_at DESC
        `,
        depositParams
      );

    /*
     * PAID WITHDRAWALS
     */
    const withdrawalParams =
      [periodStart];

    const withdrawalConditions = [
      `w.status = 'paid'`,
      `COALESCE(
        w.payment_sent_at,
        w.processed_at,
        w.created_at
      ) >= $1`,
    ];

    if (selectedStaffId) {
      withdrawalParams.push(
        selectedStaffId
      );

      withdrawalConditions.push(
        `w.approved_by = $${withdrawalParams.length}`
      );
    }

    const withdrawalsResult =
      await db.query(
        `
          SELECT
            w.id,
            w.user_id,
            w.gross_amount,
            w.fee_amount,
            w.net_amount,
            w.status,
            w.created_at,
            w.processed_at,
            w.payment_sent_at,
            w.payment_reference,
            w.approved_by,

            u.name AS member_name,
            u.phone,
            u.phone_number,
            u.account_id,

            s.name AS staff_name,
            s.staff_login,
            s.staff_report_exclusion_enabled,

            COALESCE(
              ex.excluded,
              false
            ) AS excluded_from_staff_reports,

            ex.reason AS exclusion_reason,
            ex.changed_by AS exclusion_changed_by,
            ex.updated_at AS exclusion_updated_at,

            cb.name AS exclusion_changed_by_name,
            cb.staff_login AS exclusion_changed_by_login

          FROM withdrawal_orders w

          LEFT JOIN users u
            ON u.id = w.user_id

          LEFT JOIN users s
            ON s.id =
              w.approved_by

          LEFT JOIN staff_report_exclusions ex
            ON ex.staff_id =
              w.approved_by
           AND ex.transaction_type =
              'withdrawal'
           AND ex.transaction_id =
              w.id

          LEFT JOIN users cb
            ON cb.id =
              ex.changed_by

          WHERE ${withdrawalConditions.join(
            "\n            AND "
          )}

          ORDER BY
            COALESCE(
              w.payment_sent_at,
              w.processed_at,
              w.created_at
            ) DESC
        `,
        withdrawalParams
      );

    /*
     * Normalize deposit records.
     *
     * Dashboard status is now authoritative:
     *
     * included = shared
     * pending  = decision not made
     * excluded = hidden from shared dashboard
     */
    const deposits =
      depositsResult.rows.map(
        (row) => {
          const dashboardStatus =
            [
              "pending",
              "included",
              "excluded",
            ].includes(
              String(
                row.staff_dashboard_status ||
                  ""
              ).toLowerCase()
            )
              ? String(
                  row.staff_dashboard_status
                ).toLowerCase()
              : "included";

          const isOwnStaff =
            String(
              row.assigned_staff_id
            ) ===
            String(
              session.userId
            );

          const canChange =
            session.role ===
              "admin" ||
            (
              session.role ===
                "verification_staff" &&
              isOwnStaff &&
              row.staff_report_exclusion_enabled ===
                true
            );

          return {
            ...row,

            staff_dashboard_status:
              dashboardStatus,

            amount:
              money(
                row.amount
              ),

            excluded_from_staff_reports:
              dashboardStatus ===
              "excluded",

            included_in_staff_reports:
              dashboardStatus ===
              "included",

            dashboard_decision_pending:
              dashboardStatus ===
              "pending",

            can_change_reporting_status:
              canChange,
          };
        }
      );

    const withdrawals =
      withdrawalsResult.rows.map(
        (row) => ({
          ...row,

          gross_amount:
            money(
              row.gross_amount
            ),

          fee_amount:
            money(
              row.fee_amount
            ),

          net_amount:
            money(
              row.net_amount
            ),

          excluded_from_staff_reports:
            row.excluded_from_staff_reports ===
            true,

          included_in_staff_reports:
            row.excluded_from_staff_reports !==
            true,

          can_change_reporting_status:
            session.role ===
              "admin" ||
            (
              session.role ===
                "verification_staff" &&
              String(
                row.approved_by
              ) ===
                String(
                  session.userId
                ) &&
              row.staff_report_exclusion_enabled ===
                true
            ),
        })
      );

    /*
     * Shared visibility:
     *
     * Main Admin:
     * - sees every deposit state
     *
     * Verification staff:
     * - included deposits from every staff member
     * - their own pending deposits
     * - their own excluded deposits
     *
     * Pending/excluded deposits belonging to another
     * staff member remain private.
     */
    const visibleDeposits =
      deposits.filter(
        (row) => {
          if (
            session.role ===
            "admin"
          ) {
            return true;
          }

          if (
            row.staff_dashboard_status ===
            "included"
          ) {
            return true;
          }

          return (
            String(
              row.assigned_staff_id
            ) ===
            String(
              session.userId
            )
          );
        }
      );

    const visibleWithdrawals =
      withdrawals.filter(
        (row) => {
          if (
            session.role ===
            "admin"
          ) {
            return true;
          }

          if (
            !row.excluded_from_staff_reports
          ) {
            return true;
          }

          return (
            String(
              row.approved_by
            ) ===
            String(
              session.userId
            )
          );
        }
      );

    /*
     * Reported/shared totals contain ONLY
     * explicitly included deposits.
     *
     * Withdrawals retain the existing
     * exclusion behavior.
     */
    const reportedDeposits =
      deposits.filter(
        (row) =>
          row.staff_dashboard_status ===
          "included"
      );

    const reportedWithdrawals =
      withdrawals.filter(
        (row) =>
          !row.excluded_from_staff_reports
      );

    const excludedDeposits =
      deposits.filter(
        (row) =>
          row.staff_dashboard_status ===
          "excluded"
      );

    const excludedWithdrawals =
      withdrawals.filter(
        (row) =>
          row.excluded_from_staff_reports
      );

    const pendingDeposits =
      deposits.filter(
        (row) =>
          row.staff_dashboard_status ===
          "pending"
      );

    const completeSummary =
      buildSummary(
        deposits,
        withdrawals
      );

    const reportedSummary =
      buildSummary(
        reportedDeposits,
        reportedWithdrawals
      );

    const excludedSummary =
      buildSummary(
        excludedDeposits,
        excludedWithdrawals
      );

    const pendingSummary =
      buildSummary(
        pendingDeposits,
        []
      );

    /*
     * Per-staff totals.
     *
     * Shared deposit totals count ONLY
     * included deposits.
     *
     * Excluded deposits remain separately
     * visible to Main Admin for audit.
     *
     * Pending deposits are deliberately
     * excluded from both shared and excluded
     * totals until a decision is made.
     */
    const staffTotals =
      new Map();

    for (
      const staff of
      staffResult.rows
    ) {
      staffTotals.set(
        staff.id,
        {
          staff_id:
            staff.id,

          staff_name:
            staff.name ||
            "Unnamed Staff",

          staff_login:
            staff.staff_login ||
            null,

          deposit_count: 0,
          deposit_amount: 0,

          pending_deposit_count: 0,
          pending_deposit_amount: 0,

          withdrawal_count: 0,
          withdrawal_gross: 0,
          withdrawal_fees: 0,
          withdrawal_net: 0,

          excluded_deposit_count: 0,
          excluded_deposit_amount: 0,

          excluded_withdrawal_count: 0,
          excluded_withdrawal_gross: 0,
          excluded_withdrawal_fees: 0,
          excluded_withdrawal_net: 0,
        }
      );
    }

    for (
      const row of
      deposits
    ) {
      if (
        !row.assigned_staff_id
      ) {
        continue;
      }

      const item =
        staffTotals.get(
          row.assigned_staff_id
        );

      if (!item) {
        continue;
      }

      if (
        row.staff_dashboard_status ===
        "excluded"
      ) {
        item.excluded_deposit_count +=
          1;

        item.excluded_deposit_amount +=
          money(
            row.amount
          );

        continue;
      }

      if (
        row.staff_dashboard_status ===
        "pending"
      ) {
        item.pending_deposit_count +=
          1;

        item.pending_deposit_amount +=
          money(
            row.amount
          );

        continue;
      }

      item.deposit_count +=
        1;

      item.deposit_amount +=
        money(
          row.amount
        );
    }

    for (
      const row of
      withdrawals
    ) {
      if (!row.approved_by) {
        continue;
      }

      const item =
        staffTotals.get(
          row.approved_by
        );

      if (!item) {
        continue;
      }

      if (
        row.excluded_from_staff_reports
      ) {
        item.excluded_withdrawal_count +=
          1;

        item.excluded_withdrawal_gross +=
          money(
            row.gross_amount
          );

        item.excluded_withdrawal_fees +=
          money(
            row.fee_amount
          );

        item.excluded_withdrawal_net +=
          money(
            row.net_amount
          );
      } else {
        item.withdrawal_count +=
          1;

        item.withdrawal_gross +=
          money(
            row.gross_amount
          );

        item.withdrawal_fees +=
          money(
            row.fee_amount
          );

        item.withdrawal_net +=
          money(
            row.net_amount
          );
      }
    }

    for (
      const item of
      staffTotals.values()
    ) {
      item.deposit_amount =
        Number(
          item.deposit_amount.toFixed(
            2
          )
        );

      item.pending_deposit_amount =
        Number(
          item.pending_deposit_amount.toFixed(
            2
          )
        );

      item.withdrawal_gross =
        Number(
          item.withdrawal_gross.toFixed(
            2
          )
        );

      item.withdrawal_fees =
        Number(
          item.withdrawal_fees.toFixed(
            2
          )
        );

      item.withdrawal_net =
        Number(
          item.withdrawal_net.toFixed(
            2
          )
        );

      item.excluded_deposit_amount =
        Number(
          item.excluded_deposit_amount.toFixed(
            2
          )
        );

      item.excluded_withdrawal_gross =
        Number(
          item.excluded_withdrawal_gross.toFixed(
            2
          )
        );

      item.excluded_withdrawal_fees =
        Number(
          item.excluded_withdrawal_fees.toFixed(
            2
          )
        );

      item.excluded_withdrawal_net =
        Number(
          item.excluded_withdrawal_net.toFixed(
            2
          )
        );
    }

    /*
     * Main Admin receives all staff totals.
     *
     * Verification staff receive only
     * their own staff total.
     */
    const responseStaffTotals =
      session.role === "admin"
        ? Array.from(
            staffTotals.values()
          )
        : Array.from(
            staffTotals.values()
          ).filter(
            (item) =>
              String(
                item.staff_id
              ) ===
              String(
                session.userId
              )
          );

    /*
     * Keep the staff selector available
     * to Main Admin.
     *
     * Verification staff only receive
     * their own staff record.
     */
    const responseStaff =
      session.role === "admin"
        ? staffResult.rows
        : staffResult.rows.filter(
            (staff) =>
              String(
                staff.id
              ) ===
              String(
                session.userId
              )
          );

    /*
     * Verification staff summary must contain
     * only shared/included deposits plus
     * non-excluded withdrawals.
     *
     * A pending or excluded deposit belonging
     * to another staff member cannot affect
     * their summary.
     */
    const viewerReportedDeposits =
      session.role === "admin"
        ? reportedDeposits
        : visibleDeposits.filter(
            (row) =>
              row.staff_dashboard_status ===
              "included"
          );

    const viewerReportedWithdrawals =
      session.role === "admin"
        ? reportedWithdrawals
        : visibleWithdrawals.filter(
            (row) =>
              !row.excluded_from_staff_reports
          );

    return NextResponse.json({
      period,

      search,

      selectedStaffId,

      viewer: {
        id:
          session.userId,

        role:
          session.role,

        staffReportExclusionEnabled:
          session.staff_report_exclusion_enabled ===
          true,
      },

      staff:
        responseStaff,

      summary:
        buildSummary(
          viewerReportedDeposits,
          viewerReportedWithdrawals
        ),

      completeSummary,

      reportedSummary,

      excludedSummary,

      pendingSummary,

      staffTotals:
        responseStaffTotals,

      deposits:
        visibleDeposits,

      withdrawals:
        visibleWithdrawals,
    });
  } catch (error) {
    console.error(
      "STAFF TRANSACTION REPORT ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load staff transaction records",

        details:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}
