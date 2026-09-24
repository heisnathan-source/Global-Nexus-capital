import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";


function session(request) {

  const cookie =
    request.headers.get("cookie") || "";

  const match =
    cookie.match(
      new RegExp(
        `${USER_COOKIE_NAME}=([^;]+)`
      )
    );

  const user =
    match
      ? verifySessionToken(match[1])
      : null;

  return user &&
    user.role === "user"
    ? user
    : null;

}


/*
 * =====================================================
 * NORMALIZE WITHDRAWAL STATUS
 * =====================================================
 */

function normalizeWithdrawalStatus(status) {

  const value =
    String(status || "")
      .trim()
      .toLowerCase();


  if (
    [
      "paid",
      "approved",
      "successful",
      "success",
      "completed",
      "complete"
    ].includes(value)
  ) {

    return "successful";

  }


  if (
    [
      "rejected",
      "declined",
      "failed",
      "cancelled",
      "canceled"
    ].includes(value)
  ) {

    return "rejected";

  }


  return "pending";

}


/*
 * =====================================================
 * GET FINANCIAL RECORDS
 * =====================================================
 */

export async function GET(request) {

  const user =
    session(request);


  if (!user) {

    return Response.json(
      {
        error: "Unauthorized"
      },
      {
        status: 401
      }
    );

  }


  const url =
    new URL(request.url);


  const typeFilter =
    String(
      url.searchParams.get("type") || ""
    )
      .trim()
      .toLowerCase();


  const statusFilter =
    String(
      url.searchParams.get("status") || ""
    )
      .trim()
      .toLowerCase();


  const requestedLimit =
    Number(
      url.searchParams.get("limit") || 100
    );


  const limit =
    Math.min(
      Math.max(
        Number.isFinite(requestedLimit)
          ? requestedLimit
          : 100,
        1
      ),
      200
    );


  const db =
    getDb();


  /*
   * =====================================================
   * NORMAL WALLET LEDGER RECORDS
   *
   * Withdrawal ledger entries are INTERNAL accounting
   * records and must not appear separately to users.
   *
   * User-visible withdrawals come ONLY from
   * withdrawal_orders below.
   * =====================================================
   */

  const ledgerResult =
    await db.query(
      `
        SELECT
          wl.id,

          wl.entry_type,

          wl.amount,

          wl.balance_after,

          wl.description,

          wl.created_at,


          t.type,

          t.status,

          t.reference,

          t.fee,

          t.metadata,


          NULL::uuid AS withdrawal_order_id,

          NULL::text AS withdrawal_status,

          NULL::numeric AS gross_amount,

          NULL::numeric AS net_amount,

          NULL::text AS rejection_reason,


          'ledger' AS record_source


        FROM wallet_ledger wl


        LEFT JOIN transactions t
          ON t.id = wl.transaction_id


        WHERE

          wl.user_id = $1


          /*
           * Exclude ALL withdrawal-related ledger records.
           *
           * These include:
           *
           * withdrawal_hold
           * withdrawal_refund
           * withdrawal_approved
           */

          AND wl.entry_type NOT IN (
            'withdrawal',
            'withdrawal_hold',
            'withdrawal_refund',
            'withdrawal_approved'
          )


          /*
           * Also exclude anything connected to a withdrawal
           * transaction for extra protection.
           */

          AND COALESCE(
            t.type,
            ''
          ) <> 'withdrawal'


        ORDER BY
          wl.created_at DESC
      `,
      [user.userId]
    );


  /*
   * =====================================================
   * WITHDRAWAL ORDERS
   *
   * This is the SINGLE SOURCE OF TRUTH for all
   * user-visible withdrawal records.
   *
   * Every withdrawal appears exactly once.
   * =====================================================
   */

  const withdrawalResult =
    await db.query(
      `
        SELECT

          wo.id,


          'withdrawal' AS entry_type,


          /*
           * A rejected withdrawal was refunded.
           *
           * Keep the gross amount available in metadata,
           * but show amount as 0 so it does not look like
           * money permanently left the user's wallet.
           */

          CASE

            WHEN LOWER(
              COALESCE(
                wo.status,
                ''
              )
            ) IN (
              'rejected',
              'declined',
              'failed',
              'cancelled',
              'canceled'
            )

            THEN 0

            ELSE
              -ABS(
                COALESCE(
                  wo.gross_amount,
                  0
                )
              )

          END AS amount,


          NULL::numeric AS balance_after,


          CASE

            WHEN LOWER(
              COALESCE(
                wo.status,
                ''
              )
            ) IN (
              'pending',
              'processing',
              'requested',
              'waiting'
            )

            THEN
              'Withdrawal Pending'


            WHEN LOWER(
              COALESCE(
                wo.status,
                ''
              )
            ) IN (
              'paid',
              'approved',
              'successful',
              'success',
              'completed',
              'complete'
            )

            THEN
              'Withdrawal Successful'


            WHEN LOWER(
              COALESCE(
                wo.status,
                ''
              )
            ) IN (
              'rejected',
              'declined',
              'failed',
              'cancelled',
              'canceled'
            )

            THEN
              'Withdrawal Rejected'


            ELSE
              'Withdrawal Pending'

          END AS description,


          wo.created_at,


          'withdrawal' AS type,


          wo.status,


          CONCAT(
            'WD-',
            wo.id
          ) AS reference,


          COALESCE(
            wo.fee_amount,
            0
          ) AS fee,


          jsonb_build_object(

            'grossAmount',
            wo.gross_amount,

            'feeAmount',
            wo.fee_amount,

            'netAmount',
            wo.net_amount,

            'scheduledAt',
            wo.scheduled_at,

            'processedAt',
            wo.processed_at,

            'rejectionReason',
            wo.rejection_reason

          ) AS metadata,


          wo.id AS withdrawal_order_id,


          wo.status AS withdrawal_status,


          wo.gross_amount,


          wo.net_amount,


          wo.rejection_reason,


          'withdrawal_order' AS record_source


        FROM withdrawal_orders wo


        WHERE
          wo.user_id = $1


        ORDER BY
          wo.created_at DESC
      `,
      [user.userId]
    );


  /*
   * =====================================================
   * COMBINE NORMAL RECORDS + WITHDRAWAL ORDERS
   * =====================================================
   */

  let records = [

    ...ledgerResult.rows,

    ...withdrawalResult.rows

  ];


  /*
   * =====================================================
   * NORMALIZE RECORDS
   * =====================================================
   */

  records =
    records.map(record => {

      const isWithdrawal =
        record.record_source ===
        "withdrawal_order";


      if (isWithdrawal) {

        const normalizedStatus =
          normalizeWithdrawalStatus(
            record.withdrawal_status ||
            record.status
          );


        return {

          ...record,


          type:
            "withdrawal",


          entry_type:
            "withdrawal",


          status:
            normalizedStatus,


          withdrawal_status:
            normalizedStatus

        };

      }


      return {

        ...record,


        status:
          String(
            record.status ||
            "successful"
          )
            .trim()
            .toLowerCase()

      };

    });


  /*
   * =====================================================
   * TYPE FILTER
   * =====================================================
   */

  if (typeFilter) {

    records =
      records.filter(record => {

        const recordType =
          String(
            record.type ||
            record.entry_type ||
            ""
          )
            .trim()
            .toLowerCase();


        return (
          recordType === typeFilter
        );

      });

  }


  /*
   * =====================================================
   * STATUS FILTER
   * =====================================================
   */

  if (statusFilter) {

    records =
      records.filter(record =>

        String(
          record.status || ""
        )
          .trim()
          .toLowerCase() ===
        statusFilter

      );

  }


  /*
   * =====================================================
   * SORT NEWEST FIRST
   * =====================================================
   */

  records.sort(
    (a, b) => {

      const aTime =
        new Date(
          a.created_at
        ).getTime();


      const bTime =
        new Date(
          b.created_at
        ).getTime();


      return bTime - aTime;

    }
  );


  records =
    records.slice(
      0,
      limit
    );


  /*
   * =====================================================
   * WALLET TOTALS
   *
   * These remain based on the real wallet ledger because
   * the ledger is the accounting source of truth.
   * =====================================================
   */

  const totalsResult =
    await db.query(
      `
        SELECT

          COALESCE(
            SUM(

              CASE

                WHEN amount > 0

                THEN amount

                ELSE 0

              END

            ),
            0
          ) AS total_credits,


          COALESCE(
            SUM(

              CASE

                WHEN amount < 0

                THEN ABS(amount)

                ELSE 0

              END

            ),
            0
          ) AS total_debits


        FROM wallet_ledger


        WHERE
          user_id = $1
      `,
      [user.userId]
    );


  return Response.json({

    records,


    totals: {

      credits:
        Number(
          totalsResult.rows[0]
            ?.total_credits || 0
        ),


      debits:
        Number(
          totalsResult.rows[0]
            ?.total_debits || 0
        )

    }

  });

}
