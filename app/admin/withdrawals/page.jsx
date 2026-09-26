"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

const days = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

function dateTime(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function AdminWithdrawals() {
  const [data, setData] = useState(null);

  const [enabled, setEnabled] =
    useState(true);

  const [msg, setMsg] = useState(
    "Withdrawals are currently unavailable."
  );

  const [feeMode, setFeeMode] =
    useState("percentage");

  const [feeValue, setFeeValue] =
    useState("0");

  const [minH, setMinH] =
    useState("0");

  const [maxH, setMaxH] =
    useState("48");

  const [withdrawalStartTime, setWithdrawalStartTime] =
    useState("08:00");

  const [withdrawalEndTime, setWithdrawalEndTime] =
    useState("17:00");

  const [
    globalDays,
    setGlobalDays,
  ] = useState([]);

  const [
    rankDays,
    setRankDays,
  ] = useState({});

  const [orders, setOrders] =
    useState([]);

  const [
    staff,
    setStaff,
  ] = useState([]);

  const [
    counts,
    setCounts,
  ] = useState({
    pending: 0,
    processing: 0,
    completed_today: 0,
    rejected_today: 0,
  });

  const [
    orderSearch,
    setOrderSearch,
  ] = useState("");

  const [
    queueFilter,
    setQueueFilter,
  ] = useState("all");

  const [status, setStatus] =
    useState("");

  const [error, setError] =
    useState("");

  const [
    loadingOrders,
    setLoadingOrders,
  ] = useState(false);

  const [
    processingId,
    setProcessingId,
  ] = useState(null);

  const [
    countdownTick,
    setCountdownTick,
  ] = useState(() => Date.now());

  async function loadSettings() {
    const response =
      await fetch(
        "/api/admin/withdrawal-settings",
        {
          cache: "no-store",
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Unable to load withdrawal settings."
      );
    }

    setData(result);

    const settings =
      result.settings || {};

    setEnabled(
      !!settings.enabled
    );

    setMsg(
      settings.unavailable_message ||
        "Withdrawals are currently unavailable."
    );

    setFeeMode(
      settings.fee_mode ||
        "percentage"
    );

    setFeeValue(
      String(
        settings.fee_value ?? 0
      )
    );

    setMinH(
      String(
        settings.processing_min_hours ??
          0
      )
    );

    setMaxH(
      String(
        settings.processing_max_hours ??
          48
      )
    );

    setWithdrawalStartTime(
      String(settings.withdrawal_start_time || "08:00:00").slice(0, 5)
    );

    setWithdrawalEndTime(
      String(settings.withdrawal_end_time || "17:00:00").slice(0, 5)
    );

    setGlobalDays(
      (result.globalDays || [])
        .filter(
          (row) => row.enabled
        )
        .map((row) =>
          Number(row.weekday)
        )
    );

    const map = {};

    for (
      const row of
        result.rankDays || []
    ) {
      if (!row.enabled) continue;

      if (!map[row.rank_id]) {
        map[row.rank_id] = [];
      }

      map[row.rank_id].push(
        Number(row.weekday)
      );
    }

    setRankDays(map);
  }

  async function loadOrders(
    showLoader = true
  ) {
    if (showLoader) {
      setLoadingOrders(true);
    }

    try {
      const response =
        await fetch(
          "/api/admin/withdrawals",
          {
            cache: "no-store",
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to load withdrawals."
        );
      }

      setOrders(
        result.orders || []
      );

      setStaff(
        Array.isArray(
          result.staff
        )
          ? result.staff
          : []
      );

      if (result.counts) {
        setCounts({
          pending:
            Number(
              result.counts.pending
            ) || 0,

          processing:
            Number(
              result.counts.processing
            ) || 0,

          completed_today:
            Number(
              result.counts
                .completed_today
            ) || 0,

          rejected_today:
            Number(
              result.counts
                .rejected_today
            ) || 0,
        });
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to load withdrawals."
      );
    } finally {
      if (showLoader) {
        setLoadingOrders(false);
      }
    }
  }

  async function loadAll() {
    setError("");

    try {
      await Promise.all([
        loadSettings(),
        loadOrders(),
      ]);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load withdrawal management."
      );
    }
  }

  useEffect(() => {
    loadAll();

    const interval =
      setInterval(() => {
        loadOrders(false);
      }, 30000);

    return () =>
      clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer =
      setInterval(() => {
        setCountdownTick(
          Date.now()
        );
      }, 1000);

    return () =>
      clearInterval(timer);
  }, []);

  function toggle(
    arr,
    setter,
    day
  ) {
    setter(
      arr.includes(day)
        ? arr.filter(
            (value) =>
              value !== day
          )
        : [
            ...arr,
            day,
          ].sort()
    );
  }

  function toggleRankDay(
    rankId,
    day
  ) {
    setRankDays(
      (previous) => {
        const current =
          previous[rankId] ||
          [];

        return {
          ...previous,

          [rankId]:
            current.includes(day)
              ? current.filter(
                  (value) =>
                    value !== day
                )
              : [
                  ...current,
                  day,
                ].sort(),
        };
      }
    );
  }

  async function save() {
    setStatus("Saving...");
    setError("");

    try {
      const rows =
        (data?.ranks || [])
          .map((rank) => ({
            rankId: rank.id,

            days:
              rankDays[
                rank.id
              ] || [],
          }));

      const response =
        await fetch(
          "/api/admin/withdrawal-settings",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body: JSON.stringify({
              enabled,

              unavailableMessage:
                msg,

              feeMode,

              feeValue,

              processingMinHours:
                minH,

              processingMaxHours:
                maxH,

              withdrawalStartTime,
              withdrawalEndTime,

              globalDays,

              rankDays:
                rows,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Save failed."
        );
      }

      setStatus(
        "Withdrawal settings saved successfully."
      );
    } catch (err) {
      setStatus("");

      setError(
        err.message ||
          "Unable to save withdrawal settings."
      );
    }
  }

  async function processOrder(
    order,
    action
  ) {
    if (processingId) return;

    clearMessages();

    let reason = "";
    let paymentReference =
      "";

    if (action === "reject") {
      const entered =
        window.prompt(
          "Reason for rejection:"
        );

      if (
        entered === null
      ) {
        return;
      }

      reason =
        entered.trim();

      if (!reason) {
        setError(
          "A rejection reason is required."
        );
        return;
      }
    }

    if (
      action === "pay" ||
      action === "approve"
    ) {
      const entered =
        window.prompt(
          "Enter the payment reference:"
        );

      if (
        entered === null
      ) {
        return;
      }

      paymentReference =
        entered.trim();

      if (!paymentReference) {
        setError(
          "Payment reference is required."
        );
        return;
      }
    }

    const confirmation =
      action === "reject"
        ? `Reject this withdrawal and refund GHS ${money(
            order.gross_amount
          )} to the member?`
        : `Confirm payment of GHS ${money(
            order.net_amount
          )} has been sent?`;

    if (
      !window.confirm(
        confirmation
      )
    ) {
      return;
    }

    setProcessingId(order.id);
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/withdrawals",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body: JSON.stringify({
              orderId:
                order.id,

              action,

              reason,

              paymentReference,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Withdrawal action failed."
        );
      }

      setStatus(
        action === "reject"
          ? "Withdrawal declined and refunded."
          : "Withdrawal payment recorded successfully."
      );

      await loadOrders(false);
    } catch (err) {
      setError(
        err.message ||
          "Withdrawal action failed."
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function releaseClaim(
    order
  ) {
    if (
      processingId
    ) {
      return;
    }

    if (
      !window.confirm(
        "Force release this withdrawal back to the pending queue?"
      )
    ) {
      return;
    }

    setProcessingId(order.id);
    clearMessages();

    try {
      const response =
        await fetch(
          "/api/admin/withdrawals",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body: JSON.stringify({
              orderId:
                order.id,

              action: "release",
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to release claim."
        );
      }

      setStatus(
        "Withdrawal claim released and returned to the pending queue."
      );

      await loadOrders(false);
    } catch (err) {
      setError(
        err.message ||
          "Unable to release claim."
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function reassignOrder(
    order
  ) {
    if (
      processingId
    ) {
      return;
    }

    const activeStaff =
      staff.filter(
        (member) =>
          member.is_active
      );

    if (!activeStaff.length) {
      setError(
        "No active verification staff accounts are available."
      );
      return;
    }

    const choices =
      activeStaff
        .map(
          (member, index) =>
            `${index + 1}. ${
              member.name ||
              "Unnamed"
            } (${
              member.staff_login ||
              "No Staff ID"
            })`
        )
        .join("\n");

    const selected =
      window.prompt(
        `Select verification staff by number:\n\n${choices}`
      );

    if (
      selected === null
    ) {
      return;
    }

    const index =
      Number(selected) - 1;

    if (
      !Number.isInteger(
        index
      ) ||
      !activeStaff[index]
    ) {
      setError(
        "Invalid verification staff selection."
      );
      return;
    }

    const selectedStaff =
      activeStaff[index];

    if (
      !window.confirm(
        `Reassign this withdrawal to ${
          selectedStaff.name ||
          selectedStaff.staff_login
        }?`
      )
    ) {
      return;
    }

    setProcessingId(order.id);
    clearMessages();

    try {
      const response =
        await fetch(
          "/api/admin/withdrawals",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body: JSON.stringify({
              orderId:
                order.id,

              action:
                "reassign",

              staffId:
                selectedStaff.id,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to reassign withdrawal."
        );
      }

      setStatus(
        `Withdrawal reassigned to ${
          selectedStaff.name ||
          selectedStaff.staff_login
        }.`
      );

      await loadOrders(false);
    } catch (err) {
      setError(
        err.message ||
          "Unable to reassign withdrawal."
      );
    } finally {
      setProcessingId(null);
    }
  }

  function clearMessages() {
    setError("");
    setStatus("");
  }

  const filteredOrders =
    useMemo(() => {
      const search =
        normalize(
          orderSearch
        );

      return orders.filter(
        (order) => {
          const currentStatus =
            normalize(
              order.status
            );

          if (
            queueFilter !==
              "all" &&
            currentStatus !==
              queueFilter
          ) {
            return false;
          }

          if (!search) {
            return true;
          }

          return [
            order.name,
            order.phone,
            order.id,
            `WD-${order.id}`,
            order.claimant_name,
            order.claimant_login,
            order.processor_name,
            order.processor_login,
            order.payment_reference,
            order.status,
          ]
            .filter(Boolean)
            .some((value) =>
              normalize(
                value
              ).includes(search)
            );
        }
      );
    }, [
      orders,
      orderSearch,
      queueFilter,
    ]);

  const pendingOrders =
    filteredOrders.filter(
      (order) =>
        normalize(
          order.status
        ) === "pending"
    );

  const processingOrders =
    filteredOrders.filter(
      (order) =>
        normalize(
          order.status
        ) === "processing"
    );

  const paidOrders =
    filteredOrders.filter(
      (order) =>
        normalize(
          order.status
        ) === "paid"
    );

  const rejectedOrders =
    filteredOrders.filter(
      (order) =>
        normalize(
          order.status
        ) === "rejected"
    );

  function remainingSeconds(
    order
  ) {
    if (
      order.status !==
        "processing" ||
      !order.claim_activity_at
    ) {
      return null;
    }

    const activity =
      new Date(
        order.claim_activity_at
      ).getTime();

    if (
      !Number.isFinite(
        activity
      )
    ) {
      return null;
    }

    return Math.max(
      0,
      15 * 60 -
        Math.floor(
          (countdownTick -
            activity) /
            1000
        )
    );
  }

  function countdown(
    seconds
  ) {
    if (
      seconds === null
    ) {
      return "—";
    }

    const safe =
      Math.max(
        0,
        Math.floor(seconds)
      );

    const minutes =
      Math.floor(
        safe / 60
      );

    const secs =
      safe % 60;

    return `${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      secs
    ).padStart(
      2,
      "0"
    )}`;
  }

  function QueueRow({
    order,
    processing = false,
  }) {
    const remaining =
      remainingSeconds(
        order
      );

    const busy =
      processingId ===
      order.id;

    return (
      <div
        className="list-row"
      >
        <div
          style={{
            minWidth: 0,
          }}
        >
          <strong>
            GHS{" "}
            {money(
              order.gross_amount
            )}
          </strong>

          <span className="muted">
            {order.name ||
              order.user_id}
            {" · "}
            {order.phone ||
              "No phone"}
          </span>

          <span className="muted">
            WD-{order.id}
          </span>

          <span className="muted">
            Fee: GHS{" "}
            {money(
              order.fee_amount
            )}
            {" · "}
            Net: GHS{" "}
            {money(
              order.net_amount
            )}
          </span>

          <span className="muted">
            Requested:{" "}
            {dateTime(
              order.created_at
            )}
          </span>

          {order.status ===
          "processing" ? (
            <>
              <span className="muted">
                Assigned:{" "}
                {order.claimant_name ||
                  order.claimant_login ||
                  "Verification Staff"}
              </span>

              <span className="muted">
                Claimed:{" "}
                {dateTime(
                  order.claimed_at
                )}
              </span>

              <span className="muted">
                Activity:{" "}
                {dateTime(
                  order.claim_activity_at
                )}
              </span>

              <span
                style={{
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                Claim timer:{" "}
                {countdown(
                  remaining
                )}
              </span>
            </>
          ) : null}

          {order.status ===
          "paid" ? (
            <>
              <span className="muted">
                Payment reference:{" "}
                {order.payment_reference ||
                  "—"}
              </span>

              <span className="muted">
                Paid:{" "}
                {dateTime(
                  order.payment_sent_at ||
                    order.processed_at
                )}
              </span>

              <span className="muted">
                Processor:{" "}
                {order.processor_name ||
                  order.processor_login ||
                  "—"}
              </span>
            </>
          ) : null}

          {order.status ===
          "rejected" ? (
            <>
              <span className="muted">
                Rejected:{" "}
                {dateTime(
                  order.processed_at
                )}
              </span>

              <span className="muted">
                Processor:{" "}
                {order.processor_name ||
                  order.processor_login ||
                  "—"}
              </span>

              <span className="muted">
                Reason:{" "}
                {order.rejection_reason ||
                  "—"}
              </span>
            </>
          ) : null}
        </div>

        <div className="admin-actions">
          {order.status ===
          "pending" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  reassignOrder(
                    order
                  )
                }
              >
                {busy
                  ? "Working..."
                  : "Assign"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  processOrder(
                    order,
                    "reject"
                  )
                }
              >
                {busy
                  ? "Working..."
                  : "Decline"}
              </button>
            </>
          ) : null}

          {order.status ===
          "processing" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  reassignOrder(
                    order
                  )
                }
              >
                {busy
                  ? "Working..."
                  : "Reassign"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  releaseClaim(
                    order
                  )
                }
              >
                {busy
                  ? "Working..."
                  : "Force Release"}
              </button>

              <button
                type="button"
                className="primary-button"
                disabled={
                  busy ||
                  remaining ===
                    0
                }
                onClick={() =>
                  processOrder(
                    order,
                    "pay"
                  )
                }
              >
                {busy
                  ? "Working..."
                  : "Mark Paid"}
              </button>

              <button
                type="button"
                disabled={
                  busy ||
                  remaining ===
                    0
                }
                onClick={() =>
                  processOrder(
                    order,
                    "reject"
                  )
                }
              >
                {busy
                  ? "Working..."
                  : "Reject"}
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main className="mobile-shell scroll-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Withdrawal Management
          </h1>

          <p className="muted">
            Master withdrawal queue,
            processing and settings
          </p>
        </div>

        <Link
          className="icon-button"
          href="/admin"
        >
          ←
        </Link>
      </header>

      {error && (
        <section className="admin-card">
          <p className="auth-error">
            {error}
          </p>
        </section>
      )}

      {status && (
        <section className="admin-card">
          <p className="auth-success">
            {status}
          </p>
        </section>
      )}

      <Link
        href="/admin/withdrawal-frequency"
        className="frequency-link"
      >
        <div>
          <strong>
            Multiple Withdrawals
          </strong>

          <p>
            Manage users allowed to bypass
            the one withdrawal per 24 hours
            rule.
          </p>
        </div>

        <span>→</span>
      </Link>

      {/* ================================================= */}
      {/* MASTER QUEUE SUMMARY */}
      {/* ================================================= */}

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>
            Central Withdrawal Queue
          </strong>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              loadOrders()
            }
            disabled={
              loadingOrders
            }
          >
            {loadingOrders
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        <div
          className="queue-stat-grid"
        >
          <button
            type="button"
            className={
              queueFilter ===
              "pending"
                ? "queue-stat active"
                : "queue-stat"
            }
            onClick={() =>
              setQueueFilter(
                "pending"
              )
            }
          >
            <span>
              Pending
            </span>

            <strong>
              {counts.pending}
            </strong>
          </button>

          <button
            type="button"
            className={
              queueFilter ===
              "processing"
                ? "queue-stat active"
                : "queue-stat"
            }
            onClick={() =>
              setQueueFilter(
                "processing"
              )
            }
          >
            <span>
              Processing
            </span>

            <strong>
              {counts.processing}
            </strong>
          </button>

          <button
            type="button"
            className={
              queueFilter ===
              "paid"
                ? "queue-stat active"
                : "queue-stat"
            }
            onClick={() =>
              setQueueFilter(
                "paid"
              )
            }
          >
            <span>
              Paid Today
            </span>

            <strong>
              {counts.completed_today}
            </strong>
          </button>

          <button
            type="button"
            className={
              queueFilter ===
              "rejected"
                ? "queue-stat active"
                : "queue-stat"
            }
            onClick={() =>
              setQueueFilter(
                "rejected"
              )
            }
          >
            <span>
              Rejected Today
            </span>

            <strong>
              {counts.rejected_today}
            </strong>
          </button>
        </div>

        <div
          className="queue-filter-row"
        >
          <button
            type="button"
            className={
              queueFilter ===
              "all"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() =>
              setQueueFilter(
                "all"
              )
            }
          >
            All
          </button>

          <button
            type="button"
            className={
              queueFilter ===
              "pending"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() =>
              setQueueFilter(
                "pending"
              )
            }
          >
            Pending
          </button>

          <button
            type="button"
            className={
              queueFilter ===
              "processing"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() =>
              setQueueFilter(
                "processing"
              )
            }
          >
            Processing
          </button>

          <button
            type="button"
            className={
              queueFilter ===
              "paid"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() =>
              setQueueFilter(
                "paid"
              )
            }
          >
            Paid
          </button>

          <button
            type="button"
            className={
              queueFilter ===
              "rejected"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() =>
              setQueueFilter(
                "rejected"
              )
            }
          >
            Rejected
          </button>
        </div>

        <input
          className="withdrawal-search"
          type="text"
          placeholder="Search name, phone, WD, staff, payment reference..."
          value={orderSearch}
          onChange={(event) =>
            setOrderSearch(
              event.target.value
            )
          }
        />

        {loadingOrders ? (
          <p className="muted">
            Loading withdrawal queue...
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 18,
              marginTop: 14,
            }}
          >
            {/* PENDING */}
            {(queueFilter ===
              "all" ||
              queueFilter ===
                "pending") && (
              <section>
                <div className="admin-card-head">
                  <strong>
                    Pending
                  </strong>

                  <span className="badge">
                    {pendingOrders.length}
                  </span>
                </div>

                {pendingOrders.length ===
                0 ? (
                  <div className="empty-document">
                    No pending withdrawal
                    requests.
                  </div>
                ) : (
                  pendingOrders.map(
                    (order) => (
                      <QueueRow
                        key={
                          order.id
                        }
                        order={
                          order
                        }
                      />
                    )
                  )
                )}
              </section>
            )}

            {/* PROCESSING */}
            {(queueFilter ===
              "all" ||
              queueFilter ===
                "processing") && (
              <section>
                <div className="admin-card-head">
                  <strong>
                    Currently Processing
                  </strong>

                  <span className="badge">
                    {processingOrders.length}
                  </span>
                </div>

                {processingOrders.length ===
                0 ? (
                  <div className="empty-document">
                    No withdrawals are
                    currently being
                    processed.
                  </div>
                ) : (
                  processingOrders.map(
                    (order) => (
                      <QueueRow
                        key={
                          order.id
                        }
                        order={
                          order
                        }
                        processing
                      />
                    )
                  )
                )}
              </section>
            )}

            {/* PAID */}
            {(queueFilter ===
              "all" ||
              queueFilter ===
                "paid") && (
              <section>
                <div className="admin-card-head">
                  <strong>
                    Paid / Completed
                  </strong>

                  <span className="badge">
                    {paidOrders.length}
                  </span>
                </div>

                {paidOrders.length ===
                0 ? (
                  <div className="empty-document">
                    No paid withdrawals
                    match the current
                    filter.
                  </div>
                ) : (
                  paidOrders.map(
                    (order) => (
                      <QueueRow
                        key={
                          order.id
                        }
                        order={
                          order
                        }
                      />
                    )
                  )
                )}
              </section>
            )}

            {/* REJECTED */}
            {(queueFilter ===
              "all" ||
              queueFilter ===
                "rejected") && (
              <section>
                <div className="admin-card-head">
                  <strong>
                    Rejected / Refunded
                  </strong>

                  <span className="badge">
                    {rejectedOrders.length}
                  </span>
                </div>

                {rejectedOrders.length ===
                0 ? (
                  <div className="empty-document">
                    No rejected withdrawals
                    match the current
                    filter.
                  </div>
                ) : (
                  rejectedOrders.map(
                    (order) => (
                      <QueueRow
                        key={
                          order.id
                        }
                        order={
                          order
                        }
                      />
                    )
                  )
                )}
              </section>
            )}
          </div>
        )}
      </section>

      {/* ================================================= */}
      {/* GLOBAL SWITCH */}
      {/* ================================================= */}

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>
            Global Withdrawal Switch
          </strong>

          <button
            type="button"
            className={
              enabled
                ? "status-on"
                : "status-off"
            }
            onClick={() =>
              setEnabled(
                !enabled
              )
            }
          >
            {enabled
              ? "ON"
              : "OFF"}
          </button>
        </div>

        <label>
          Unavailable message

          <input
            value={msg}
            onChange={(event) =>
              setMsg(
                event.target.value
              )
            }
          />
        </label>
      </section>

      {/* ================================================= */}
      {/* GLOBAL SETTINGS */}
      {/* ================================================= */}

      <section className="admin-card">
        <strong>
          Global Settings
        </strong>

        <div className="setting-grid">
          <label>
            Fee mode

            <select
              value={feeMode}
              onChange={(event) =>
                setFeeMode(
                  event.target.value
                )
              }
            >
              <option value="percentage">
                Percentage
              </option>

              <option value="fixed">
                Fixed
              </option>
            </select>
          </label>

          <label>
            Fee value

            <input
              type="number"
              min="0"
              step="0.01"
              value={feeValue}
              onChange={(event) =>
                setFeeValue(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Processing min hours

            <input
              type="number"
              min="0"
              value={minH}
              onChange={(event) =>
                setMinH(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Processing max hours

            <input
              type="number"
              min="0"
              value={maxH}
              onChange={(event) =>
                setMaxH(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Withdrawal opens (Ghana time)

            <input
              type="time"
              value={withdrawalStartTime}
              onChange={(event) =>
                setWithdrawalStartTime(event.target.value)
              }
            />
          </label>

          <label>
            Withdrawal closes (Ghana time)

            <input
              type="time"
              value={withdrawalEndTime}
              onChange={(event) =>
                setWithdrawalEndTime(event.target.value)
              }
            />
          </label>
        </div>
      </section>

      {/* ================================================= */}
      {/* GLOBAL DAYS */}
      {/* ================================================= */}

      <section className="admin-card">
        <strong>
          Global Allowed Days
        </strong>

        <div className="rank-day-row">
          {days.map(
            (day, index) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={globalDays.includes(
                    index
                  )}
                  onChange={() =>
                    toggle(
                      globalDays,
                      setGlobalDays,
                      index
                    )
                  }
                />

                <span>
                  {day}
                </span>
              </label>
            )
          )}
        </div>
      </section>

      {/* ================================================= */}
      {/* RANK DAYS */}
      {/* ================================================= */}

      <section className="admin-card">
        <strong>
          Rank Withdrawal Days
        </strong>

        {(data?.ranks || []).map(
          (rank) => (
            <div
              className="rank-day-row"
              key={rank.id}
            >
              <strong>
                {rank.name}
              </strong>

              <div>
                {days.map(
                  (
                    day,
                    index
                  ) => (
                    <label key={day}>
                      <input
                        type="checkbox"
                        checked={(
                          rankDays[
                            rank.id
                          ] || []
                        ).includes(
                          index
                        )}
                        onChange={() =>
                          toggleRankDay(
                            rank.id,
                            index
                          )
                        }
                      />

                      <span>
                        {day}
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>
          )
        )}
      </section>

      {/* ================================================= */}
      {/* SAVE */}
      {/* ================================================= */}

      <section className="admin-card">
        <button
          className="primary-button"
          type="button"
          onClick={save}
        >
          Save Withdrawal Settings
        </button>
      </section>

      <style jsx>{`
        .frequency-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;

          margin-bottom: 18px;
          padding: 18px;

          border-radius: 18px;

          text-decoration: none;

          color: inherit;

          background:
            linear-gradient(
              135deg,
              rgba(31, 131, 74, .10),
              rgba(72, 101, 165, .08)
            );

          border:
            1px solid
            rgba(72, 101, 165, .16);

          transition:
            transform .15s ease,
            box-shadow .15s ease;
        }

        .frequency-link:hover {
          transform:
            translateY(-1px);

          box-shadow:
            0 8px 24px
            rgba(40, 60, 90, .08);
        }

        .frequency-link strong {
          display: block;
          font-size: 16px;
          color: #26334a;
        }

        .frequency-link p {
          margin: 5px 0 0;
          color: #6f7b8e;
          font-size: 13px;
          line-height: 1.45;
        }

        .frequency-link span {
          width: 42px;
          height: 42px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border-radius: 50%;

          background: #21834a;
          color: white;

          font-size: 22px;
          font-weight: 800;
        }

        .withdrawal-search {
          width: 100%;
          box-sizing: border-box;

          margin: 16px 0;

          padding: 13px 15px;

          border-radius: 13px;

          border:
            1px solid
            rgba(40, 60, 90, .15);

          font-size: 14px;

          outline: none;
        }

        .withdrawal-search:focus {
          border-color:
            rgba(33, 131, 74, .65);

          box-shadow:
            0 0 0 3px
            rgba(33, 131, 74, .08);
        }

        .queue-stat-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 14px;
        }

        .queue-stat {
          border: 1px solid
            rgba(40, 60, 90, .10);
          background:
            rgba(255,255,255,.72);
          border-radius: 13px;
          padding: 12px 8px;
          text-align: left;
          cursor: pointer;
        }

        .queue-stat.active {
          border-color:
            rgba(33,131,74,.55);
          box-shadow:
            0 0 0 3px
            rgba(33,131,74,.07);
        }

        .queue-stat span {
          display: block;
          color: #6f7b8e;
          font-size: 11px;
          margin-bottom: 4px;
        }

        .queue-stat strong {
          font-size: 20px;
        }

        .queue-filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        @media (max-width: 620px) {
          .queue-stat-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        .list-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 0;
          border-bottom:
            1px solid
            rgba(40,60,90,.08);
        }

        .list-row > div:first-child {
          display: grid;
          gap: 4px;
        }

        .admin-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          justify-content: flex-end;
        }

        .admin-actions button {
          white-space: nowrap;
        }

        @media (max-width: 700px) {
          .list-row {
            flex-direction: column;
          }

          .admin-actions {
            width: 100%;
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
