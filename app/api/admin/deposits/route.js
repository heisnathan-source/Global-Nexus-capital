import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
  VERIFICATION_COOKIE_NAME
} from "@/lib/session.js";

import {
  processBonusDrawForUser
} from "@/lib/bonus-draw-service.js";

function getSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const adminMatch = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  if (adminMatch) {
    const admin = verifySessionToken(adminMatch[1]);

    if (
      admin &&
      (admin.role === "admin" ||
        admin.role === "verification_staff")
    ) {
      return admin;
    }
  }

  const staffMatch = cookie.match(
    new RegExp(`${VERIFICATION_COOKIE_NAME}=([^;]+)`)
  );

  if (staffMatch) {
    const staff = verifySessionToken(staffMatch[1]);

    if (
      staff &&
      staff.role === "verification_staff"
    ) {
      return staff;
    }
  }

  return null;
}

async function getUserDashboardPermission(client, userId) {
  const result = await client.query(
    `
    SELECT
      id,
      role,
      staff_report_exclusion_enabled
    FROM users
    WHERE id = $1
    FOR UPDATE
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/*
 * Main Admin or the responsible verification staff member
 * can make the final shared-dashboard decision.
 *
 * include:
 *   Makes the verified deposit visible to the shared
 *   staff dashboard and counts it toward liquidity.
 *
 * exclude:
 *   Keeps the deposit out of the shared dashboard and
 *   out of liquidity distribution.
 */
async function setDashboardDecision(
  session,
  orderId,
  action,
  reason
) {
  if (!["include", "exclude"].includes(action)) {
    return Response.json(
      {
        error:
          "Valid dashboard action is required."
      },
      { status: 400 }
    );
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const q = await client.query(
      `
      SELECT
        d.id,
        d.user_id,
        d.amount,
        d.assigned_staff_id,
        d.status,
        d.staff_dashboard_status,

        staff.name AS assigned_staff_name,
        staff.staff_login AS assigned_staff_login,
        staff.staff_report_exclusion_enabled

      FROM deposit_orders d

      LEFT JOIN users staff
        ON staff.id = d.assigned_staff_id

      WHERE d.id = $1

      FOR UPDATE OF d
      `,
      [orderId]
    );

    if (!q.rowCount) {
      throw new Error(
        "Deposit order not found."
      );
    }

    const order = q.rows[0];

    if (order.status !== "verified") {
      throw new Error(
        "Only verified deposits can receive a dashboard decision."
      );
    }

    /*
     * Verification staff may only decide for deposits
     * assigned directly to themselves.
     *
     * Main Admin can decide for every deposit.
     */
    if (session.role === "verification_staff") {
      if (
        !order.assigned_staff_id ||
        String(order.assigned_staff_id) !==
          String(session.userId)
      ) {
        throw new Error(
          "This deposit is not assigned to you."
        );
      }

      /*
       * Permission is checked again from the database,
       * rather than trusting the session.
       */
      const staff = await getUserDashboardPermission(
        client,
        session.userId
      );

      if (
        !staff ||
        staff.role !== "verification_staff"
      ) {
        throw new Error(
          "Verification staff account not found."
        );
      }

      if (
        !staff.staff_report_exclusion_enabled
      ) {
        throw new Error(
          "You do not have permission to change dashboard inclusion."
        );
      }
    }

    /*
     * A responsible staff member can only choose
     * include/exclude when they have the special permission.
     *
     * Main Admin is unrestricted.
     */
    if (
      session.role === "verification_staff" &&
      !order.staff_report_exclusion_enabled
    ) {
      throw new Error(
        "Dashboard inclusion permission is not enabled for this staff member."
      );
    }

    const newStatus =
      action === "include"
        ? "included"
        : "excluded";

    if (newStatus === "excluded" && !String(reason || "").trim()) {
      throw new Error(
        "A reason is required when excluding a deposit."
      );
    }

    /*
     * Save the explicit dashboard state.
     */
    await client.query(
      `
      UPDATE deposit_orders
      SET
        staff_dashboard_status = $2
      WHERE id = $1
      `,
      [
        orderId,
        newStatus
      ]
    );

    /*
     * Keep the existing staff-report exclusion table
     * synchronized with the dashboard decision.
     *
     * This table is also used by the staff transaction
     * reporting and liquidity systems.
     */
    await client.query(
      `
      INSERT INTO staff_report_exclusions(
        staff_id,
        transaction_type,
        transaction_id,
        excluded,
        reason,
        changed_by,
        created_at,
        updated_at
      )
      VALUES(
        $1,
        'deposit',
        $2,
        $3,
        $4,
        $5,
        NOW(),
        NOW()
      )
      ON CONFLICT (
        staff_id,
        transaction_type,
        transaction_id
      )
      DO UPDATE SET
        excluded = EXCLUDED.excluded,
        reason = EXCLUDED.reason,
        changed_by = EXCLUDED.changed_by,
        updated_at = NOW()
      `,
      [
        order.assigned_staff_id,
        orderId,
        newStatus === "excluded",
        newStatus === "excluded"
          ? String(reason || "").trim()
          : null,
        session.userId
      ]
    );

    await client.query(
      `
      INSERT INTO audit_logs(
        user_id,
        action,
        target_type,
        target_id,
        metadata
      )
      VALUES(
        $1,
        $2,
        'deposit',
        $3,
        $4
      )
      `,
      [
        session.userId,
        newStatus === "included"
          ? "deposit_dashboard_included"
          : "deposit_dashboard_excluded",
        orderId,
        JSON.stringify({
          amount: order.amount,
          assignedStaffId:
            order.assigned_staff_id,
          previousStatus:
            order.staff_dashboard_status,
          newStatus,
          reason:
            newStatus === "excluded"
              ? String(reason || "").trim()
              : null
        })
      ]
    );

    await client.query("COMMIT");

    return Response.json({
      status: newStatus,
      orderId
    });
  } catch (error) {
    await client.query("ROLLBACK");

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to change dashboard status."
      },
      { status: 400 }
    );
  } finally {
    client.release();
  }
}

export async function POST(request) {
  const session = getSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();

  const {
    orderId,
    action,
    reason
  } = body || {};

  /*
   * Dashboard decision actions are deliberately handled
   * separately from verify/reject so verification does not
   * accidentally expose a deposit before the responsible
   * staff member makes the decision.
   */
  if (
    ["include", "exclude"].includes(action)
  ) {
    return setDashboardDecision(
      session,
      orderId,
      action,
      reason
    );
  }

  if (
    !orderId ||
    !["verify", "reject"].includes(action)
  ) {
    return Response.json(
      {
        error:
          "Valid order and action are required."
      },
      { status: 400 }
    );
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    /*
     * Lock the deposit and load its current assignment.
     */
    const q = await client.query(
      `
      SELECT
        d.id,
        d.user_id,
        d.amount,
        d.payment_phone,
        d.payment_sender_name,
        d.network_id,
        d.wallet_id,
        d.assigned_staff_id,
        d.status,
        d.staff_dashboard_status,

        p.account_number,
        p.recipient_name,

        pn.name AS payment_network

      FROM deposit_orders d

      LEFT JOIN payment_wallet_pool p
        ON p.id = d.wallet_id

      LEFT JOIN payment_networks pn
        ON pn.id = d.network_id

      WHERE d.id = $1

      FOR UPDATE OF d
      `,
      [orderId]
    );

    if (!q.rowCount) {
      throw new Error(
        "Deposit order not found."
      );
    }

    const order = q.rows[0];

    /*
     * Main Admin can manage every deposit.
     *
     * Verification staff can ONLY manage a deposit
     * assigned directly to themselves.
     */
    if (session.role === "verification_staff") {
      if (
        !order.assigned_staff_id ||
        String(order.assigned_staff_id) !==
          String(session.userId)
      ) {
        throw new Error(
          "This deposit is not assigned to you."
        );
      }
    }

    if (order.status === "verified") {
      throw new Error(
        "Deposit has already been verified."
      );
    }

    if (
      ![
        "payment_submitted",
        "awaiting_payment"
      ].includes(order.status)
    ) {
      throw new Error(
        "Deposit is not in a verifiable state."
      );
    }

    if (action === "reject") {
      await client.query(
        `
        UPDATE deposit_orders
        SET
          status = 'rejected',
          verified_at = NOW(),
          verified_by = $2
        WHERE id = $1
        `,
        [
          orderId,
          session.userId
        ]
      );

      if (order.wallet_id) {
        await client.query(
          `
          UPDATE payment_wallet_pool
          SET in_use = FALSE
          WHERE id = $1
          `,
          [order.wallet_id]
        );
      }

      await client.query(
        `
        INSERT INTO admin_actions(
          admin_user_id,
          action_type,
          target_type,
          target_id,
          reason
        )
        VALUES(
          $1,
          'deposit_rejected',
          'deposit',
          $2,
          $3
        )
        `,
        [
          session.userId,
          orderId,
          reason ||
            "Payment not verified"
        ]
      );

      await client.query("COMMIT");

      return Response.json({
        status: "rejected"
      });
    }

    /*
     * Determine whether this staff member has the special
     * dashboard inclusion/exclusion permission.
     *
     * Main Admin never needs to wait for this decision.
     */
    let staffCanChooseDashboardStatus = false;

    if (
      session.role === "verification_staff"
    ) {
      const staff = await getUserDashboardPermission(
        client,
        session.userId
      );

      staffCanChooseDashboardStatus =
        Boolean(
          staff?.staff_report_exclusion_enabled
        );
    } else if (
      session.role === "admin"
    ) {
      /*
       * Main Admin verifies the deposit directly as included
       * unless an explicit later admin exclusion is made.
       */
      staffCanChooseDashboardStatus = false;
    }

    const wallet = await client.query(
      `
      SELECT available_balance
      FROM wallets
      WHERE user_id = $1
      FOR UPDATE
      `,
      [order.user_id]
    );

    if (!wallet.rowCount) {
      throw new Error(
        "User wallet not found."
      );
    }

    const currentBalance =
      Number(
        wallet.rows[0].available_balance
      );

    const depositAmount =
      Number(order.amount);

    const after =
      currentBalance + depositAmount;

    await client.query(
      `
      UPDATE wallets
      SET
        available_balance = $1,
        updated_at = NOW()
      WHERE user_id = $2
      `,
      [
        after,
        order.user_id
      ]
    );

    const tx = await client.query(
      `
      INSERT INTO transactions(
        user_id,
        type,
        amount,
        fee,
        status,
        reference,
        metadata
      )
      VALUES(
        $1,
        'deposit',
        $2,
        0,
        'successful',
        $3,
        $4
      )
      RETURNING id
      `,
      [
        order.user_id,
        order.amount,
        `DEP-${order.id}`,
        JSON.stringify({
          depositOrderId:
            order.id,
          paymentPhone:
            order.payment_phone,
          paymentSenderName:
            order.payment_sender_name,
          paymentNetwork:
            order.payment_network,
          accountNumber:
            order.account_number,
          recipientName:
            order.recipient_name,
          verifiedBy:
            session.userId
        })
      ]
    );

    await client.query(
      `
      INSERT INTO wallet_ledger(
        user_id,
        transaction_id,
        entry_type,
        amount,
        balance_after,
        description
      )
      VALUES(
        $1,
        $2,
        'deposit',
        $3,
        $4,
        'Verified deposit'
      )
      `,
      [
        order.user_id,
        tx.rows[0].id,
        order.amount,
        after
      ]
    );

    await processBonusDrawForUser(
      order.user_id,
      client
    );

    /*
     * IMPORTANT:
     *
     * If the responsible verification staff has the
     * inclusion/exclusion permission, the deposit becomes
     * PENDING for the shared dashboard.
     *
     * Other staff therefore cannot see it in the live
     * dashboard until Staff A chooses Include or Exclude.
     *
     * Staff without the permission automatically become
     * INCLUDED so their workflow is unchanged.
     */
    const dashboardStatus =
      staffCanChooseDashboardStatus
        ? "pending"
        : "included";

    await client.query(
      `
      UPDATE deposit_orders
      SET
        status = 'verified',
        verified_at = NOW(),
        verified_by = $2,
        staff_dashboard_status = $3
      WHERE id = $1
      `,
      [
        orderId,
        session.userId,
        dashboardStatus
      ]
    );

    if (order.wallet_id) {
      await client.query(
        `
        UPDATE payment_wallet_pool
        SET in_use = FALSE
        WHERE id = $1
        `,
        [order.wallet_id]
      );
    }

    await client.query(
      `
      INSERT INTO admin_actions(
        admin_user_id,
        action_type,
        target_type,
        target_id,
        metadata
      )
      VALUES(
        $1,
        'deposit_verified',
        'deposit',
        $2,
        $3
      )
      `,
      [
        session.userId,
        orderId,
        JSON.stringify({
          amount:
            order.amount,
          userId:
            order.user_id,
          paymentPhone:
            order.payment_phone,
          paymentSenderName:
            order.payment_sender_name,
          paymentNetwork:
            order.payment_network,
          accountNumber:
            order.account_number,
          recipientName:
            order.recipient_name,
          staffDashboardStatus:
            dashboardStatus
        })
      ]
    );

    await client.query("COMMIT");

    return Response.json({
      status: "verified",
      balanceAfter: after,
      staffDashboardStatus:
        dashboardStatus,
      dashboardDecisionRequired:
        dashboardStatus === "pending"
    });
  } catch (e) {
    await client.query("ROLLBACK");

    return Response.json(
      {
        error:
          e?.message ||
          "Unable to process deposit."
      },
      { status: 400 }
    );
  } finally {
    client.release();
  }
}

export async function GET(request) {
  const session = getSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const db = getDb();

  try {
    /*
     * GLOBAL COUNT
     *
     * Every staff member can see how many deposits
     * are currently waiting for verification, regardless
     * of assignment.
     */
    const countResult = await db.query(
      `
      SELECT COUNT(*)::int AS count
      FROM deposit_orders
      WHERE status IN (
        'payment_submitted',
        'awaiting_payment'
      )
      `
    );

    const globalPendingCount =
      Number(
        countResult.rows[0]?.count || 0
      );

    /*
     * ORDER LIST
     *
     * Main Admin sees all pending verification deposits.
     *
     * Verification staff sees ONLY deposits assigned
     * directly to themselves.
     *
     * Additionally, a verified deposit with a PENDING
     * dashboard decision is shown to its responsible staff
     * so they can make the Include/Exclude decision.
     */
    const params = [];

    let assignmentClause = "";

    if (
      session.role ===
      "verification_staff"
    ) {
      params.push(session.userId);

      assignmentClause =
        `
        AND d.assigned_staff_id = $1
        `;
    }

    const r = await db.query(
      `
      SELECT
        d.id,
        d.user_id,

        u.name AS user_name,
        u.phone AS registered_phone,

        d.payment_phone,
        d.payment_sender_name,
        d.amount,
        d.status,
        d.staff_dashboard_status,
        d.created_at,
        d.payment_submitted_at,
        d.verified_at,

        d.wallet_id,
        d.assigned_staff_id,

        p.account_number,
        p.recipient_name,

        pn.name AS payment_network,

        staff.name AS assigned_staff_name,
        staff.staff_login AS assigned_staff_login,
        staff.staff_report_exclusion_enabled

      FROM deposit_orders d

      LEFT JOIN users u
        ON u.id = d.user_id

      LEFT JOIN payment_wallet_pool p
        ON p.id = d.wallet_id

      LEFT JOIN payment_networks pn
        ON pn.id = d.network_id

      LEFT JOIN users staff
        ON staff.id = d.assigned_staff_id

      WHERE
        (
          d.status IN (
            'payment_submitted',
            'awaiting_payment'
          )
          OR
          (
            d.status = 'verified'
            AND d.staff_dashboard_status = 'pending'
          )
        )

      ${assignmentClause}

      ORDER BY d.created_at ASC
      `,
      params
    );

    /*
     * Main Admin can see pending dashboard decisions
     * for every staff member.
     *
     * Verification staff only see their own rows because
     * of the assignment clause above.
     */
    return Response.json({
      orders: r.rows,
      globalPendingCount,
      assignedPendingCount:
        r.rows.filter(
          (row) =>
            [
              "payment_submitted",
              "awaiting_payment"
            ].includes(row.status)
        ).length,
      pendingDashboardDecisionCount:
        r.rows.filter(
          (row) =>
            row.status === "verified" &&
            row.staff_dashboard_status ===
              "pending"
        ).length,
      currentUser: {
        id: session.userId,
        role: session.role
      }
    });
  } catch (error) {
    console.error(
      "GET /api/admin/deposits:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load deposits."
      },
      { status: 500 }
    );
  } finally {
  }
}
