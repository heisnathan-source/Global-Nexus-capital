import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
  VERIFICATION_COOKIE_NAME,
} from "@/lib/session.js";
import { getDb } from "@/lib/db.js";

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(
    new RegExp(
      `(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]+)`
    )
  );

  return match ? match[1] : null;
}

function getSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const adminToken = getCookieValue(
    cookie,
    ADMIN_COOKIE_NAME
  );

  const verificationToken = getCookieValue(
    cookie,
    VERIFICATION_COOKIE_NAME
  );

  const adminSession = adminToken
    ? verifySessionToken(adminToken)
    : null;

  if (
    adminSession &&
    (adminSession.role === "admin" ||
      adminSession.role === "verification_staff")
  ) {
    return adminSession;
  }

  const verificationSession =
    verificationToken
      ? verifySessionToken(verificationToken)
      : null;

  if (
    verificationSession &&
    verificationSession.role ===
      "verification_staff"
  ) {
    return verificationSession;
  }

  return null;
}

function normalizeWithdrawalStatus(status) {
  switch (
    String(status || "").toLowerCase()
  ) {
    case "paid":
      return "paid";

    case "processing":
      return "processing";

    case "rejected":
      return "rejected";

    case "pending":
      return "pending";

    default:
      return status || "pending";
  }
}

function normalizeMetadata(metadata) {
  if (!metadata) return {};

  if (typeof metadata === "object") {
    return metadata;
  }

  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);

      if (
        parsed &&
        typeof parsed === "object"
      ) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
}

export async function GET(request) {
  const session = getSession(request);

  if (!session) {
    return Response.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  const db = getDb();

  try {
    /*
     * =====================================================
     * WITHDRAWALS
     * =====================================================
     */

    const withdrawals = await db.query(`
      SELECT
        wo.id AS withdrawal_order_id,
        wo.user_id,
        wo.gross_amount,
        wo.fee_amount,
        wo.net_amount,
        wo.status AS withdrawal_status,
        wo.created_at,
        wo.processed_at,
        wo.claimed_at,
        wo.payment_reference,
        wo.payment_sent_at,
        wo.rejection_reason,

        u.name,
        u.phone,
        u.phone_number,
        u.account_id,

        cb.name AS claimed_by_name,
        cb.staff_login AS claimed_by_login,

        pb.name AS processor_name,
        pb.staff_login AS processor_login

      FROM withdrawal_orders wo

      LEFT JOIN users u
        ON u.id = wo.user_id

      LEFT JOIN users cb
        ON cb.id = wo.claimed_by

      LEFT JOIN users pb
        ON pb.id = wo.approved_by

      ORDER BY wo.created_at DESC
    `);

    const withdrawalRecords =
      withdrawals.rows.map((row) => {
        const phone =
          row.phone ||
          row.phone_number ||
          null;

        return {
          id: row.withdrawal_order_id,

          withdrawal_order_id:
            row.withdrawal_order_id,

          transaction_id: null,

          type: "withdrawal",
          entry_type: "withdrawal",

          reference:
            `WD-${row.withdrawal_order_id}`,

          amount: row.gross_amount,

          gross_amount:
            row.gross_amount,

          fee_amount:
            row.fee_amount,

          net_amount:
            row.net_amount,

          status:
            normalizeWithdrawalStatus(
              row.withdrawal_status
            ),

          withdrawal_status:
            normalizeWithdrawalStatus(
              row.withdrawal_status
            ),

          name: row.name || null,

          full_name:
            row.name || null,

          username:
            row.account_id || null,

          phone,

          claimed_by_name:
            row.claimed_by_name || null,

          claimed_by_login:
            row.claimed_by_login || null,

          processor_name:
            row.processor_name || null,

          processor_login:
            row.processor_login || null,

          staff_name:
            row.processor_name ||
            row.claimed_by_name ||
            null,

          claimed_at:
            row.claimed_at,

          payment_reference:
            row.payment_reference,

          payment_sent_at:
            row.payment_sent_at,

          processed_at:
            row.processed_at,

          rejection_reason:
            row.rejection_reason,

          created_at:
            row.created_at,
        };
      });

    /*
     * =====================================================
     * DEPOSITS
     *
     * Deposit information comes from deposit_orders,
     * not from the user's Global Nexus Capital account number.
     * =====================================================
     */

    const deposits = await db.query(`
      SELECT
        d.id AS deposit_order_id,
        d.user_id,

        d.amount,
        d.status AS deposit_status,

        d.payment_phone,
        d.payment_sender_name,

        d.network_id,
        d.wallet_id,

        d.assigned_staff_id,

        d.created_at,
        d.payment_submitted_at,
        d.verified_at,
        d.verified_by,

        u.name,
        u.phone AS registered_phone,
        u.phone_number,
        u.account_id,

        p.account_number,
        p.recipient_name,

        pn.name AS payment_network,

        staff.name AS assigned_staff_name,
        staff.staff_login AS assigned_staff_login,

        verifier.name AS verified_by_name,
        verifier.staff_login AS verified_by_login

      FROM deposit_orders d

      LEFT JOIN users u
        ON u.id = d.user_id

      LEFT JOIN payment_wallet_pool p
        ON p.id = d.wallet_id

      LEFT JOIN payment_networks pn
        ON pn.id = d.network_id

      LEFT JOIN users staff
        ON staff.id = d.assigned_staff_id

      LEFT JOIN users verifier
        ON verifier.id = d.verified_by

      ORDER BY d.created_at DESC
    `);

    const depositRecords =
      deposits.rows.map((row) => {
        const registeredPhone =
          row.registered_phone ||
          row.phone_number ||
          row.phone ||
          null;

        return {
          id: row.deposit_order_id,

          deposit_order_id:
            row.deposit_order_id,

          withdrawal_order_id: null,

          transaction_id: null,

          type: "deposit",
          entry_type: "deposit",

          reference:
            `DEP-${row.deposit_order_id}`,

          amount: row.amount,

          gross_amount: row.amount,

          fee_amount: 0,

          net_amount: row.amount,

          status:
            row.deposit_status || "pending",

          withdrawal_status: null,

          name: row.name || null,

          full_name:
            row.name || null,

          /*
           * This remains the member's Global Nexus Capital account
           * identifier, but it is NOT used as the
           * payment sender search field.
           */
          username:
            row.account_id || null,

          phone: registeredPhone,

          registered_phone:
            registeredPhone,

          /*
           * Actual phone used to send the payment.
           */
          payment_phone:
            row.payment_phone || null,

          /*
           * Name belonging to the payment account
           * that sent the money.
           */
          payment_sender_name:
            row.payment_sender_name || null,

          /*
           * Global Nexus Capital payment destination.
           */
          payment_network:
            row.payment_network || null,

          payment_account:
            row.account_number || null,

          account_number:
            row.account_number || null,

          payment_number:
            row.account_number || null,

          recipient_name:
            row.recipient_name || null,

          recipient:
            row.recipient_name || null,

          assigned_staff_id:
            row.assigned_staff_id || null,

          assigned_staff_name:
            row.assigned_staff_name || null,

          assigned_staff_login:
            row.assigned_staff_login || null,

          staff_name:
            row.assigned_staff_name || null,

          staff_login:
            row.assigned_staff_login || null,

          verified_by:
            row.verified_by || null,

          verified_by_name:
            row.verified_by_name || null,

          verified_by_login:
            row.verified_by_login || null,

          claimed_by_name: null,
          claimed_by_login: null,

          processor_name:
            row.verified_by_name || null,

          processor_login:
            row.verified_by_login || null,

          claimed_at: null,

          payment_reference:
            `DEP-${row.deposit_order_id}`,

          payment_sent_at:
            row.payment_submitted_at || null,

          payment_submitted_at:
            row.payment_submitted_at || null,

          processed_at:
            row.verified_at || null,

          verified_at:
            row.verified_at || null,

          rejection_reason: null,

          description:
            "Deposit",

          metadata: {
            depositOrderId:
              row.deposit_order_id,

            paymentPhone:
              row.payment_phone || null,

            paymentSenderName:
              row.payment_sender_name || null,

            paymentNetwork:
              row.payment_network || null,

            accountNumber:
              row.account_number || null,

            recipientName:
              row.recipient_name || null,

            assignedStaffId:
              row.assigned_staff_id || null,

            assignedStaffName:
              row.assigned_staff_name || null,

            verifiedBy:
              row.verified_by || null,
          },

          created_at:
            row.created_at,
        };
      });

    /*
     * =====================================================
     * OTHER TRANSACTIONS
     *
     * Keep existing transaction records such as
     * revenue, expenditure, etc.
     * =====================================================
     */

    const transactions = await db.query(`
      SELECT
        t.id,
        t.user_id,
        t.type,
        t.amount,
        t.fee,
        t.status,
        t.reference,
        t.metadata,
        t.created_at,

        u.name,
        u.phone,
        u.phone_number,
        u.account_id

      FROM transactions t

      LEFT JOIN users u
        ON u.id = t.user_id

      WHERE LOWER(
        COALESCE(t.type, '')
      ) <> 'withdrawal'

      AND LOWER(
        COALESCE(t.type, '')
      ) <> 'deposit'

      ORDER BY t.created_at DESC
    `);

    const normalRecords =
      transactions.rows.map((row) => {
        const metadata =
          normalizeMetadata(
            row.metadata
          );

        const phone =
          row.phone ||
          row.phone_number ||
          null;

        return {
          id: row.id,

          transaction_id: row.id,

          withdrawal_order_id: null,

          deposit_order_id: null,

          type: row.type,

          entry_type: row.type,

          reference: row.reference,

          amount: row.amount,

          gross_amount: row.amount,

          fee_amount: row.fee || 0,

          net_amount:
            Number(row.amount || 0) -
            Number(row.fee || 0),

          status: row.status,

          withdrawal_status: null,

          name: row.name || null,

          full_name:
            row.name || null,

          username:
            row.account_id || null,

          phone,

          registered_phone: phone,

          payment_phone:
            metadata.paymentPhone ||
            null,

          payment_sender_name:
            metadata.paymentSenderName ||
            null,

          payment_network:
            metadata.paymentNetwork ||
            null,

          payment_account:
            metadata.accountNumber ||
            null,

          account_number:
            metadata.accountNumber ||
            null,

          payment_number:
            metadata.accountNumber ||
            null,

          recipient_name:
            metadata.recipientName ||
            null,

          recipient:
            metadata.recipientName ||
            null,

          claimed_by_name: null,
          claimed_by_login: null,

          processor_name: null,
          processor_login: null,

          staff_name: null,

          claimed_at: null,

          payment_reference:
            metadata.payment_reference ||
            null,

          payment_sent_at: null,

          processed_at: null,

          rejection_reason: null,

          description:
            metadata.description ||
            metadata.note ||
            row.type ||
            "Transaction",

          metadata,

          created_at:
            row.created_at,
        };
      });

    /*
     * =====================================================
     * COMBINE EVERYTHING
     * =====================================================
     */

    const records = [
      ...withdrawalRecords,
      ...depositRecords,
      ...normalRecords,
    ].sort((a, b) => {
      const aTime =
        new Date(
          a.created_at || 0
        ).getTime();

      const bTime =
        new Date(
          b.created_at || 0
        ).getTime();

      return bTime - aTime;
    });

    return Response.json({
      records,
      count: records.length,
    });
  } catch (error) {
    console.error(
      "GET /api/admin/transaction-records:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load transaction records.",
      },
      {
        status: 500,
      }
    );
  }
}
