"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CLAIM_TIMEOUT_SECONDS = 15 * 60;

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function dateTime(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function matchesSearch(item, search) {
  const value = String(search || "")
    .trim()
    .toLowerCase();

  if (!value) return true;

  return JSON.stringify(item)
    .toLowerCase()
    .includes(value);
}

function formatCountdown(seconds) {
  if (
    !Number.isFinite(Number(seconds)) ||
    Number(seconds) < 0
  ) {
    return "15:00";
  }

  const total = Math.max(0, Math.floor(Number(seconds)));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remaining
  ).padStart(2, "0")}`;
}

export default function MiniAdminDashboard() {
  const router = useRouter();

  const [tab, setTab] = useState("deposits");

  const [deposits, setDeposits] = useState([]);
  const [globalPendingDeposits, setGlobalPendingDeposits] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);

  const [staffLiquidity, setStaffLiquidity] = useState([]);
  const [liquidityTotals, setLiquidityTotals] = useState(null);
  const [liquidityLoading, setLiquidityLoading] = useState(true);

  const [depositSearch, setDepositSearch] = useState("");
  const [withdrawalSearch, setWithdrawalSearch] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [counts, setCounts] = useState({
    pending: 0,
    processing: 0,
    completed_today: 0,
    rejected_today: 0,
  });

  const [countdownTick, setCountdownTick] =
    useState(() => Date.now());

  function clearMessages() {
    setError("");
    setStatus("");
  }

  async function loadData(showLoader = true) {
    if (showLoader) {
      setLoading(true);
    }

    setError("");

    try {
      const [
        depositResponse,
        withdrawalResponse,
        liquidityResponse,
      ] = await Promise.all([
        fetch("/api/admin/deposits", {
          cache: "no-store",
        }),
        fetch("/api/admin/withdrawals", {
          cache: "no-store",
        }),
        fetch("/api/admin/withdrawal-liquidity", {
          cache: "no-store",
        }),
      ]);

      const depositData =
        await depositResponse.json();

      const withdrawalData =
        await withdrawalResponse.json();

      const liquidityData =
        await liquidityResponse.json();

      if (!depositResponse.ok) {
        throw new Error(
          depositData.error ||
            "Unable to load deposits."
        );
      }

      if (!withdrawalResponse.ok) {
        throw new Error(
          withdrawalData.error ||
            "Unable to load withdrawals."
        );
      }

      if (!liquidityResponse.ok) {
        throw new Error(
          liquidityData.error ||
            "Unable to load staff liquidity."
        );
      }

      setStaffLiquidity(
        Array.isArray(liquidityData.staff)
          ? liquidityData.staff
          : []
      );

      setLiquidityTotals(
        liquidityData.totals || null
      );

      setDeposits(
        Array.isArray(depositData.orders)
          ? depositData.orders
          : Array.isArray(
              depositData.deposits
            )
          ? depositData.deposits
          : []
      );

      setGlobalPendingDeposits(
        Number(
          depositData.globalPendingCount || 0
        )
      );

      setWithdrawals(
        Array.isArray(
          withdrawalData.orders
        )
          ? withdrawalData.orders
          : Array.isArray(
              withdrawalData.withdrawals
            )
          ? withdrawalData.withdrawals
          : []
      );

      if (withdrawalData.counts) {
        setCounts({
          pending:
            Number(
              withdrawalData.counts.pending
            ) || 0,
          processing:
            Number(
              withdrawalData.counts.processing
            ) || 0,
          completed_today:
            Number(
              withdrawalData.counts
                .completed_today
            ) || 0,
          rejected_today:
            Number(
              withdrawalData.counts
                .rejected_today
            ) || 0,
        });
      }

      if (withdrawalData.currentUser) {
        setCurrentUser(
          withdrawalData.currentUser
        );
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to load verification data."
      );
    } finally {
      if (showLoader) {
        setLoading(false);
      }

      setLiquidityLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    const refreshTimer = setInterval(() => {
      loadData(false);
    }, 30000);

    return () => clearInterval(refreshTimer);
  }, []);

  /*
   * Local countdown refresh.
   *
   * The server remains authoritative. This only updates
   * the visible countdown every second.
   */
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownTick(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  /*
   * Send a heartbeat for every withdrawal currently
   * assigned to this staff member.
   *
   * The server decides whether the claim is still valid.
   */
  useEffect(() => {
    if (
      !currentUser ||
      currentUser.role !==
        "verification_staff"
    ) {
      return;
    }

    const assigned = withdrawals.filter(
      (order) =>
        order.status === "processing" &&
        order.claimed_by_me
    );

    if (!assigned.length) {
      return;
    }

    const heartbeat = async () => {
      for (const order of assigned) {
        try {
          await fetch(
            "/api/admin/withdrawals",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                orderId: order.id,
                action: "touch",
              }),
            }
          );
        } catch {
          // The next refresh will reconcile the
          // authoritative server state.
        }
      }
    };

    heartbeat();

    const timer = setInterval(
      heartbeat,
      60000
    );

    return () => clearInterval(timer);
  }, [
    currentUser,
    withdrawals,
  ]);

  async function depositAction(order, action) {
    clearMessages();

    const actionText =
      action === "verify"
        ? "verify this deposit"
        : "reject this deposit";

    if (
      !window.confirm(
        `Are you sure you want to ${actionText}?`
      )
    ) {
      return;
    }

    setWorking(
      `deposit-${order.id}-${action}`
    );

    try {
      const response = await fetch(
        "/api/admin/deposits",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            orderId: order.id,
            action,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Unable to ${action} deposit.`
        );
      }

      setStatus(
        action === "verify"
          ? "Deposit verified successfully."
          : "Deposit rejected successfully."
      );

      await loadData(false);
    } catch (err) {
      setError(
        err.message ||
          `Unable to ${action} deposit.`
      );
    } finally {
      setWorking("");
    }
  }

  async function dashboardDecision(
    order,
    action
  ) {
    clearMessages();

    if (
      !["include", "exclude"].includes(action)
    ) {
      return;
    }

    let reason = "";

    if (action === "exclude") {
      const entered =
        window.prompt(
          "Enter the reason for excluding this deposit from the shared dashboard:"
        );

      if (entered === null) {
        return;
      }

      reason = entered.trim();

      if (!reason) {
        setError(
          "A reason is required when excluding a deposit."
        );
        return;
      }

      if (reason.length > 500) {
        setError(
          "Exclusion reason is too long."
        );
        return;
      }
    }

    const actionText =
      action === "include"
        ? "include this deposit in the shared staff dashboard"
        : "exclude this deposit from the shared staff dashboard";

    if (
      !window.confirm(
        `Are you sure you want to ${actionText}?`
      )
    ) {
      return;
    }

    setWorking(
      `deposit-${order.id}-${action}`
    );

    try {
      const response =
        await fetch(
          "/api/admin/deposits",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              orderId: order.id,
              action,
              reason,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Unable to ${action} deposit.`
        );
      }

      setStatus(
        action === "include"
          ? "Deposit included in the shared staff dashboard."
          : "Deposit excluded from the shared staff dashboard."
      );

      await loadData(false);
    } catch (err) {
      setError(
        err.message ||
          `Unable to ${action} deposit.`
      );
    } finally {
      setWorking("");
    }
  }

  async function withdrawalAction(
    order,
    action
  ) {
    clearMessages();

    /*
     * Claiming.
     */
    if (action === "claim") {
      if (
        !window.confirm(
          "Claim this withdrawal for processing?"
        )
      ) {
        return;
      }

      setWorking(
        `withdrawal-${order.id}-claim`
      );

      try {
        const response =
          await fetch(
            "/api/admin/withdrawals",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                orderId: order.id,
                action: "claim",
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to claim withdrawal."
          );
        }

        setStatus(
          "Withdrawal claimed successfully. You now have 15 minutes of processing activity time."
        );

        await loadData(false);
      } catch (err) {
        setError(
          err.message ||
            "Unable to claim withdrawal."
        );
      } finally {
        setWorking("");
      }

      return;
    }

    /*
     * Payment Sent.
     */
    if (action === "pay") {
      const paymentReference =
        window.prompt(
          "Enter the payment reference:"
        );

      if (
        paymentReference === null
      ) {
        return;
      }

      const cleanReference =
        paymentReference.trim();

      if (!cleanReference) {
        setError(
          "Payment reference is required."
        );
        return;
      }

      if (
        cleanReference.length > 160
      ) {
        setError(
          "Payment reference is too long."
        );
        return;
      }

      if (
        !window.confirm(
          `Confirm that ₵${money(
            order.net_amount
          )} has been sent to the withdrawal destination.\n\nPayment reference: ${cleanReference}`
        )
      ) {
        return;
      }

      setWorking(
        `withdrawal-${order.id}-pay`
      );

      try {
        const response =
          await fetch(
            "/api/admin/withdrawals",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                orderId: order.id,
                action: "pay",
                paymentReference:
                  cleanReference,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to finalize withdrawal."
          );
        }

        setStatus(
          "Payment recorded successfully. Withdrawal marked as paid."
        );

        await loadData(false);
      } catch (err) {
        setError(
          err.message ||
            "Unable to finalize withdrawal."
        );
      } finally {
        setWorking("");
      }

      return;
    }

    /*
     * Reject + refund.
     */
    if (action === "reject") {
      const reason =
        window.prompt(
          "Enter the reason for rejecting this withdrawal:"
        );

      if (reason === null) {
        return;
      }

      const cleanReason =
        reason.trim();

      if (!cleanReason) {
        setError(
          "A rejection reason is required."
        );
        return;
      }

      if (
        cleanReason.length > 500
      ) {
        setError(
          "Rejection reason is too long."
        );
        return;
      }

      if (
        !window.confirm(
          `Reject this withdrawal and refund ₵${money(
            order.gross_amount
          )} to the member's available balance?`
        )
      ) {
        return;
      }

      setWorking(
        `withdrawal-${order.id}-reject`
      );

      try {
        const response =
          await fetch(
            "/api/admin/withdrawals",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                orderId: order.id,
                action: "reject",
                reason: cleanReason,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to reject withdrawal."
          );
        }

        setStatus(
          "Withdrawal rejected and refunded successfully."
        );

        await loadData(false);
      } catch (err) {
        setError(
          err.message ||
            "Unable to reject withdrawal."
        );
      } finally {
        setWorking("");
      }

      return;
    }
  }

  async function logout() {
    try {
      await fetch(
        "/api/auth/verification-logout",
        {
          method: "POST",
        }
      );
    } finally {
      router.replace(
        "/mini-admin/login"
      );
      router.refresh();
    }
  }

  const dashboardDecisionDeposits =
    useMemo(
      () =>
        deposits.filter(
          (item) =>
            String(
              item.status || ""
            ).toLowerCase() === "verified" &&
            String(
              item.staff_dashboard_status || ""
            ).toLowerCase() === "pending" &&
            matchesSearch(
              item,
              depositSearch
            )
        ),
      [deposits, depositSearch]
    );

  const visibleDeposits = useMemo(
    () =>
      deposits.filter(
        (item) =>
          matchesSearch(
            item,
            depositSearch
          ) &&
          [
            "payment_submitted",
            "awaiting_payment",
          ].includes(
            String(
              item.status || ""
            ).toLowerCase()
          )
      ),
    [deposits, depositSearch]
  );

  const visibleWithdrawals =
    useMemo(
      () =>
        withdrawals.filter(
          (item) =>
            matchesSearch(
              item,
              withdrawalSearch
            ) &&
            [
              "pending",
              "processing",
            ].includes(
              String(
                item.status || ""
              ).toLowerCase()
            )
        ),
      [
        withdrawals,
        withdrawalSearch,
      ]
    );

  const pendingWithdrawals =
    visibleWithdrawals.filter(
      (item) =>
        String(
          item.status || ""
        ).toLowerCase() === "pending"
    );

  const myProcessingWithdrawals =
    visibleWithdrawals.filter(
      (item) =>
        String(
          item.status || ""
        ).toLowerCase() ===
          "processing" &&
        item.claimed_by_me
    );

  const otherProcessingWithdrawals =
    visibleWithdrawals.filter(
      (item) =>
        String(
          item.status || ""
        ).toLowerCase() ===
          "processing" &&
        !item.claimed_by_me
    );

  const actionRequired =
    visibleDeposits.length +
    pendingWithdrawals.length +
    myProcessingWithdrawals.length;

  function getRemainingSeconds(order) {
    if (
      order.status !==
        "processing" ||
      !order.claimed_by_me
    ) {
      return null;
    }

    if (
      Number.isFinite(
        Number(
          order.claim_remaining_seconds
        )
      )
    ) {
      const serverSeconds =
        Number(
          order.claim_remaining_seconds
        );

      const serverTime =
        Number(order.claim_activity_at
          ? new Date(
              order.claim_activity_at
            ).getTime()
          : 0);

      if (serverTime) {
        const elapsed =
          Math.floor(
            (countdownTick -
              serverTime) /
              1000
          );

        return Math.max(
          0,
          serverSeconds - elapsed
        );
      }

      return Math.max(
        0,
        serverSeconds
      );
    }

    return CLAIM_TIMEOUT_SECONDS;
  }

  function WithdrawalCard({
    order,
    locked = false,
  }) {
    const remaining =
      getRemainingSeconds(order);

    const isClaimedByMe =
      order.claimed_by_me === true;

    const claimWorking =
      working ===
      `withdrawal-${order.id}-claim`;

    const payWorking =
      working ===
      `withdrawal-${order.id}-pay`;

    const rejectWorking =
      working ===
      `withdrawal-${order.id}-reject`;

    return (
      <div
        key={order.id}
        style={{
          border:
            "1px solid rgba(0,0,0,.08)",
          borderRadius: 14,
          padding: 14,
          background:
            locked
              ? "rgba(245,245,245,.85)"
              : "rgba(255,255,255,.72)",
          opacity: locked ? 0.9 : 1,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <div>
            <strong>
              Withdrawal
            </strong>

            <p
              className="muted"
              style={{
                margin: "6px 0",
                fontSize: 12,
              }}
            >
              WD: {order.id}
            </p>
          </div>

          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding:
                "5px 8px",
              borderRadius: 999,
              background:
                order.status ===
                "processing"
                  ? "rgba(245,158,11,.14)"
                  : "rgba(34,197,94,.12)",
            }}
          >
            {order.status ===
            "processing"
              ? "PROCESSING"
              : "PENDING"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gap: 5,
            fontSize: 14,
            marginTop: 8,
          }}
        >
          <div>
            <strong>
              User:
            </strong>{" "}
            {order.name ||
              order.user_name ||
              "—"}
          </div>

          <div>
            <strong>
              Phone:
            </strong>{" "}
            {order.phone ||
              order.user_phone ||
              "—"}
          </div>

          <div>
            <strong>
              Gross:
            </strong>{" "}
            ₵
            {money(
              order.gross_amount
            )}
          </div>

          <div>
            <strong>
              Fee:
            </strong>{" "}
            ₵
            {money(
              order.fee_amount
            )}
          </div>

          <div>
            <strong>
              Net:
            </strong>{" "}
            ₵
            {money(
              order.net_amount
            )}
          </div>

          <div>
            <strong>
              Requested:
            </strong>{" "}
            {dateTime(
              order.created_at
            )}
          </div>
        </div>

        {order.status ===
          "processing" ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              background:
                locked
                  ? "rgba(0,0,0,.05)"
                  : "rgba(245,158,11,.10)",
            }}
          >
            <strong>
              {isClaimedByMe
                ? "Assigned to You"
                : "Being processed"}
            </strong>

            <div
              className="muted"
              style={{
                marginTop: 4,
                fontSize: 13,
              }}
            >
              Staff:{" "}
              {order.claimant_name ||
                order.claimant_login ||
                "Verification Staff"}
            </div>

            <div
              className="muted"
              style={{
                marginTop: 3,
                fontSize: 13,
              }}
            >
              Claimed:{" "}
              {dateTime(
                order.claimed_at
              )}
            </div>

            {isClaimedByMe &&
            remaining !== null ? (
              <div
                style={{
                  marginTop: 8,
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {remaining <= 0
                  ? "Claim expired"
                  : `Processing time remaining: ${formatCountdown(
                      remaining
                    )}`}
              </div>
            ) : (
              <div
                className="muted"
                style={{
                  marginTop: 8,
                  fontSize: 13,
                }}
              >
                This withdrawal is locked to the
                assigned staff member. You cannot
                approve or reject it.
              </div>
            )}
          </div>
        ) : null}

        {order.status ===
          "processing" &&
        isClaimedByMe ? (
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gap: 5,
              fontSize: 14,
            }}
          >
            <div>
              <strong>
                Payment destination:
              </strong>{" "}
              {order.payment_destination ||
                order.payment_phone ||
                order.phone ||
                "—"}
            </div>

            {order.payment_network ? (
              <div>
                <strong>
                  Network:
                </strong>{" "}
                {order.payment_network}
              </div>
            ) : null}
          </div>
        ) : null}

        {order.status ===
          "pending" ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="primary-button"
              disabled={claimWorking}
              onClick={() =>
                withdrawalAction(
                  order,
                  "claim"
                )
              }
            >
              {claimWorking
                ? "Claiming..."
                : "Claim Withdrawal"}
            </button>
          </div>
        ) : null}

        {order.status ===
          "processing" &&
        isClaimedByMe ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="primary-button"
              disabled={
                payWorking ||
                remaining === 0
              }
              onClick={() =>
                withdrawalAction(
                  order,
                  "pay"
                )
              }
            >
              {payWorking
                ? "Recording Payment..."
                : "Payment Sent"}
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={
                rejectWorking ||
                remaining === 0
              }
              onClick={() =>
                withdrawalAction(
                  order,
                  "reject"
                )
              }
            >
              {rejectWorking
                ? "Rejecting..."
                : "Reject"}
            </button>
          </div>
        ) : null}

        {locked ? (
          <div
            style={{
              marginTop: 14,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            🔒 Locked — no action available.
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="mobile-shell scroll-page">
      <img className="global-brand-logo mini-admin-brand-logo" src="/cmc-logo.jpeg" alt="Global Nexus Capital" />
      <header className="admin-dashboard-header">
        <div className="admin-dashboard-title">
          <div className="eyebrow">
            Global Nexus Capital VERIFICATION
          </div>

          <h1>Mini Admin</h1>

          <p>
            Deposit and withdrawal
            verification
          </p>
        </div>

        <div className="admin-dashboard-actions">
          <button
            type="button"
            className="admin-header-button"
            onClick={() =>
              loadData()
            }
            disabled={loading}
          >
            Refresh
          </button>

          <button
            type="button"
            className="admin-header-button admin-logout-button"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      <section className="admin-pending-card">
        <div className="admin-pending-main">
          <span className="admin-pending-label">
            Action Required
          </span>

          <strong>
            {actionRequired}
          </strong>

          <span className="admin-pending-text">
            Requests requiring your
            attention
          </span>
        </div>

        <div className="admin-pending-links">
          <button
            type="button"
            onClick={() =>
              setTab("deposits")
            }
          >
            <span>
              Deposits
            </span>

            <strong>
              {globalPendingDeposits}
            </strong>

            <small
              style={{
                display: "block",
                marginTop: 3,
                opacity: 0.7,
                fontSize: 11,
              }}
            >
              {visibleDeposits.length} assigned to you
            </small>
          </button>

          <button
            type="button"
            onClick={() =>
              setTab("withdrawals")
            }
          >
            <span>
              Withdrawals
            </span>

            <strong>
              {counts.pending +
                myProcessingWithdrawals.length}
            </strong>
          </button>
        </div>
      </section>

      {error ? (
        <section
          className="admin-card"
          style={{
            marginBottom: 12,
          }}
        >
          <strong>
            Error
          </strong>

          <p className="muted">
            {error}
          </p>
        </section>
      ) : null}

      {status ? (
        <section
          className="admin-card"
          style={{
            marginBottom: 12,
          }}
        >
          <strong>
            Success
          </strong>

          <p className="muted">
            {status}
          </p>
        </section>
      ) : null}

      <section
        className="admin-card"
        style={{
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          <div
            style={{
              padding: 10,
              borderRadius: 12,
              background:
                "rgba(34,197,94,.08)",
            }}
          >
            <div
              className="muted"
              style={{
                fontSize: 11,
              }}
            >
              Pending
            </div>

            <strong>
              {counts.pending}
            </strong>
          </div>

          <div
            style={{
              padding: 10,
              borderRadius: 12,
              background:
                "rgba(245,158,11,.08)",
            }}
          >
            <div
              className="muted"
              style={{
                fontSize: 11,
              }}
            >
              Processing
            </div>

            <strong>
              {counts.processing}
            </strong>
          </div>

          <div
            style={{
              padding: 10,
              borderRadius: 12,
              background:
                "rgba(59,130,246,.08)",
            }}
          >
            <div
              className="muted"
              style={{
                fontSize: 11,
              }}
            >
              Completed Today
            </div>

            <strong>
              {counts.completed_today}
            </strong>
          </div>

          <div
            style={{
              padding: 10,
              borderRadius: 12,
              background:
                "rgba(239,68,68,.08)",
            }}
          >
            <div
              className="muted"
              style={{
                fontSize: 11,
              }}
            >
              Rejected Today
            </div>

            <strong>
              {counts.rejected_today}
            </strong>
          </div>
        </div>
      </section>

      {dashboardDecisionDeposits.length > 0 ? (
        <section
          className="admin-card"
          style={{
            marginBottom: 12,
            border:
              "1px solid rgba(245,158,11,.30)",
          }}
        >
          <div className="section-heading">
            <div>
              <h2>
                Dashboard Decision Required
              </h2>

              <p className="muted">
                These verified deposits are waiting for
                the responsible staff member to decide
                whether they should appear on the shared
                staff dashboard.
              </p>
            </div>

            <strong>
              {dashboardDecisionDeposits.length}
            </strong>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 12,
            }}
          >
            {dashboardDecisionDeposits.map(
              (order) => (
                <div
                  key={`dashboard-decision-${order.id}`}
                  style={{
                    border:
                      "1px solid rgba(0,0,0,.08)",
                    borderRadius: 14,
                    padding: 14,
                    background:
                      "rgba(245,158,11,.06)",
                  }}
                >
                  <strong>
                    ₵{money(order.amount)}
                  </strong>

                  <p
                    className="muted"
                    style={{
                      margin:
                        "5px 0 10px",
                      fontSize: 12,
                    }}
                  >
                    Order: {order.id}
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gap: 4,
                      fontSize: 14,
                    }}
                  >
                    <div>
                      <strong>
                        User:
                      </strong>{" "}
                      {order.user_name ||
                        "—"}
                    </div>

                    <div>
                      <strong>
                        Payment phone:
                      </strong>{" "}
                      {order.payment_phone ||
                        "—"}
                    </div>

                    <div>
                      <strong>
                        Name on payment account:
                      </strong>{" "}
                      {order.payment_sender_name ||
                        "—"}
                    </div>

                    <div>
                      <strong>
                        Network:
                      </strong>{" "}
                      {order.payment_network ||
                        "—"}
                    </div>

                    <div>
                      <strong>
                        Assigned staff:
                      </strong>{" "}
                      {order.assigned_staff_name ||
                        order.assigned_staff_login ||
                        "—"}
                    </div>

                    <div>
                      <strong>
                        Dashboard status:
                      </strong>{" "}
                      Pending decision
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="primary-button"
                      disabled={
                        working ===
                          `deposit-${order.id}-include` ||
                        working ===
                          `deposit-${order.id}-exclude`
                      }
                      onClick={() =>
                        dashboardDecision(
                          order,
                          "include"
                        )
                      }
                    >
                      {working ===
                      `deposit-${order.id}-include`
                        ? "Including..."
                        : "Include"}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        working ===
                          `deposit-${order.id}-include` ||
                        working ===
                          `deposit-${order.id}-exclude`
                      }
                      onClick={() =>
                        dashboardDecision(
                          order,
                          "exclude"
                        )
                      }
                    >
                      {working ===
                      `deposit-${order.id}-exclude`
                        ? "Excluding..."
                        : "Exclude"}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      ) : null}

      <section
        className="admin-card"
        style={{
          marginBottom: 12,
        }}
      >
        <div className="section-heading">
          <div>
            <h2>
              Live Staff Liquidity
            </h2>

            <p className="muted">
              Included deposits increase available
              liquidity. Paid net withdrawals and active
              reservations reduce it. Pending and excluded
              deposits are not available for withdrawal
              allocation.
            </p>
          </div>

          {liquidityTotals ? (
            <strong>
              ₵{money(
                liquidityTotals.availableLiquidity
              )}
            </strong>
          ) : null}
        </div>

        {liquidityLoading ? (
          <p className="muted">
            Loading staff liquidity...
          </p>
        ) : staffLiquidity.length === 0 ? (
          <p className="muted">
            No verification staff found.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 12,
            }}
          >
            {staffLiquidity.map(
              (staff) => (
                <div
                  key={`liquidity-${staff.staffId}`}
                  style={{
                    border:
                      "1px solid rgba(0,0,0,.08)",
                    borderRadius: 14,
                    padding: 14,
                    background:
                      "rgba(255,255,255,.72)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: 10,
                      alignItems:
                        "flex-start",
                    }}
                  >
                    <div>
                      <strong>
                        {staff.staffName ||
                          "Unnamed Staff"}
                      </strong>

                      {staff.staffLogin ? (
                        <div
                          className="muted"
                          style={{
                            fontSize: 12,
                            marginTop: 2,
                          }}
                        >
                          {staff.staffLogin}
                        </div>
                      ) : null}
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                      }}
                    >
                      <div
                        className="muted"
                        style={{
                          fontSize: 11,
                        }}
                      >
                        Available
                      </div>

                      <strong>
                        ₵{money(
                          staff.availableLiquidity
                        )}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(3, minmax(0, 1fr))",
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    <div>
                      <div
                        className="muted"
                        style={{
                          fontSize: 11,
                        }}
                      >
                        Included deposits
                      </div>

                      <strong>
                        ₵{money(
                          staff.eligibleDeposits
                        )}
                      </strong>
                    </div>

                    <div>
                      <div
                        className="muted"
                        style={{
                          fontSize: 11,
                        }}
                      >
                        Withdrawals made
                      </div>

                      <strong>
                        ₵{money(
                          staff.withdrawalsMade
                        )}
                      </strong>
                    </div>

                    <div>
                      <div
                        className="muted"
                        style={{
                          fontSize: 11,
                        }}
                      >
                        Reserved
                      </div>

                      <strong>
                        ₵{money(
                          staff.reservedAmount
                        )}
                      </strong>
                    </div>
                  </div>

                  {Number(
                    staff.pendingDeposits || 0
                  ) > 0 ? (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                      }}
                    >
                      <strong>
                        Pending dashboard decision:
                      </strong>{" "}
                      ₵{money(
                        staff.pendingDeposits
                      )}
                    </div>
                  ) : null}

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                    }}
                  >
                    Status:{" "}
                    {staff.withdrawalLiquidityEnabled
                      ? "Liquidity allocation enabled"
                      : "Liquidity allocation disabled"}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      <section className="admin-card">
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className={
              tab === "deposits"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() =>
              setTab("deposits")
            }
          >
            Deposits
          </button>

          <button
            type="button"
            className={
              tab === "withdrawals"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() =>
              setTab("withdrawals")
            }
          >
            Withdrawals
          </button>

          <Link
            href="/mini-admin/transactions"
            className="secondary-button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            Transaction Records
          </Link>

  <Link
    href="/mini-admin/staff-transactions"
    className="secondary-button"
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textDecoration: "none",
    }}
  >
    Staff Transaction Reports
  </Link>
        </div>

        {tab === "deposits" ? (
          <>
            <div className="section-heading">
              <div>
                <h2>
                  Deposit Verification
                </h2>

                <p className="muted">
                  Review and verify submitted
                  deposit orders.
                </p>
              </div>
            </div>

            <input
              className="text-input"
              value={depositSearch}
              onChange={(event) =>
                setDepositSearch(
                  event.target.value
                )
              }
              placeholder="Search order, phone, user, amount..."
            />

            {loading ? (
              <p className="muted">
                Loading deposits...
              </p>
            ) : visibleDeposits.length ===
              0 ? (
              <p className="muted">
                No pending deposits found.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  marginTop: 14,
                }}
              >
                {visibleDeposits.map(
                  (order) => {
                    const depositStatus =
                      String(
                        order.status || ""
                      ).toLowerCase();

                    return (
                      <div
                        key={order.id}
                        style={{
                          border:
                            "1px solid rgba(0,0,0,.08)",
                          borderRadius: 14,
                          padding: 14,
                          background:
                            "rgba(255,255,255,.72)",
                        }}
                      >
                        <strong>
                          Deposit
                        </strong>

                        <p
                          className="muted"
                          style={{
                            margin:
                              "6px 0",
                            fontSize: 12,
                          }}
                        >
                          Order:{" "}
                          {order.id}
                        </p>

                        <div
                          style={{
                            display:
                              "grid",
                            gap: 4,
                            fontSize: 14,
                          }}
                        >
                          <div>
                            <strong>
                              Amount:
                            </strong>{" "}
                            ₵
                            {money(
                              order.amount ||
                                order.gross_amount
                            )}
                          </div>

                          <div>
                            <strong>
                              User:
                            </strong>{" "}
                            {order.user_name ||
                              order.name ||
                              order.user?.name ||
                              "—"}
                          </div>

                          <div>
                            <strong>
                              Registered phone:
                            </strong>{" "}
                            {order.registered_phone ||
                              order.phone ||
                              order.user_phone ||
                              order.user?.phone ||
                              "—"}
                          </div>

                          <div>
                            <strong>
                              Payment phone:
                            </strong>{" "}
                            {order.payment_phone ||
                              "—"}
                          </div>

                          <div>
                            <strong>
                              Name on payment account:
                            </strong>{" "}
                            {order.payment_sender_name ||
                              "—"}
                          </div>

                          <div>
                            <strong>
                              Network:
                            </strong>{" "}
                            {order.payment_network ||
                              order.network ||
                              "—"}
                          </div>

                          <div>
                            <strong>
                              Payment number:
                            </strong>{" "}
                            {order.account_number ||
                              order.payment_number ||
                              order.wallet_number ||
                              "—"}
                          </div>

                          <div>
                            <strong>
                              Recipient:
                            </strong>{" "}
                            {order.recipient_name ||
                              order.recipient ||
                              "—"}
                          </div>

                          <div>
                            <strong>
                              Status:
                            </strong>{" "}
                            {depositStatus ===
                            "payment_submitted"
                              ? "Payment submitted"
                              : "Awaiting payment"}
                          </div>

                          <div>
                            <strong>
                              Created:
                            </strong>{" "}
                            {dateTime(
                              order.created_at
                            )}
                          </div>

                          {order.payment_submitted_at ? (
                            <div>
                              <strong>
                                Payment submitted:
                              </strong>{" "}
                              {dateTime(
                                order.payment_submitted_at
                              )}
                            </div>
                          ) : null}
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                            marginTop: 14,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <button
                            type="button"
                            className="primary-button"
                            disabled={
                              working ===
                              `deposit-${order.id}-verify`
                            }
                            onClick={() =>
                              depositAction(
                                order,
                                "verify"
                              )
                            }
                          >
                            {working ===
                            `deposit-${order.id}-verify`
                              ? "Verifying..."
                              : "Verify Deposit"}
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            disabled={
                              working ===
                              `deposit-${order.id}-reject`
                            }
                            onClick={() =>
                              depositAction(
                                order,
                                "reject"
                              )
                            }
                          >
                            {working ===
                            `deposit-${order.id}-reject`
                              ? "Rejecting..."
                              : "Reject"}
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="section-heading">
              <div>
                <h2>
                  Withdrawal Queue
                </h2>

                <p className="muted">
                  Claim a pending withdrawal before
                  processing payment. Only the assigned
                  staff member can finalize or reject it.
                </p>
              </div>
            </div>

            <input
              className="text-input"
              value={withdrawalSearch}
              onChange={(event) =>
                setWithdrawalSearch(
                  event.target.value
                )
              }
              placeholder="Search WD, phone, user, amount..."
            />

            {loading ? (
              <p className="muted">
                Loading withdrawals...
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 18,
                  marginTop: 14,
                }}
              >
                <section>
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      marginBottom:
                        10,
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                      }}
                    >
                      Pending Queue
                    </h3>

                    <strong>
                      {pendingWithdrawals.length}
                    </strong>
                  </div>

                  {pendingWithdrawals.length ===
                  0 ? (
                    <p className="muted">
                      No pending withdrawals.
                    </p>
                  ) : (
                    <div
                      style={{
                        display:
                          "grid",
                        gap: 12,
                      }}
                    >
                      {pendingWithdrawals.map(
                        (order) => (
                          <WithdrawalCard
                            key={
                              order.id
                            }
                            order={
                              order
                            }
                          />
                        )
                      )}
                    </div>
                  )}
                </section>

                <section>
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      marginBottom:
                        10,
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                      }}
                    >
                      Assigned to You
                    </h3>

                    <strong>
                      {
                        myProcessingWithdrawals.length
                      }
                    </strong>
                  </div>

                  {myProcessingWithdrawals.length ===
                  0 ? (
                    <p className="muted">
                      You have no withdrawals
                      currently assigned to you.
                    </p>
                  ) : (
                    <div
                      style={{
                        display:
                          "grid",
                        gap: 12,
                      }}
                    >
                      {myProcessingWithdrawals.map(
                        (order) => (
                          <WithdrawalCard
                            key={
                              order.id
                            }
                            order={
                              order
                            }
                          />
                        )
                      )}
                    </div>
                  )}
                </section>

                <section>
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      marginBottom:
                        10,
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                      }}
                    >
                      Other Staff Processing
                    </h3>

                    <strong>
                      {
                        otherProcessingWithdrawals.length
                      }
                    </strong>
                  </div>

                  {otherProcessingWithdrawals.length ===
                  0 ? (
                    <p className="muted">
                      No withdrawals are currently
                      locked by another staff member.
                    </p>
                  ) : (
                    <div
                      style={{
                        display:
                          "grid",
                        gap: 12,
                      }}
                    >
                      {otherProcessingWithdrawals.map(
                        (order) => (
                          <WithdrawalCard
                            key={
                              order.id
                            }
                            order={
                              order
                            }
                            locked
                          />
                        )
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
