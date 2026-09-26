"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function money(value) {
  const n = Number(value || 0);
  return `GH₵ ${n.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusLabel(status) {
  const map = {
    pending: "Pending",
    processing: "Processing",
    paid: "Paid",
    rejected: "Rejected",
    successful: "Successful",
    failed: "Failed",
  };

  return map[String(status || "").toLowerCase()] || status || "—";
}

function statusClass(status) {
  switch (String(status || "").toLowerCase()) {
    case "paid":
    case "successful":
      return "status success";

    case "rejected":
    case "failed":
      return "status danger";

    case "processing":
      return "status processing";

    default:
      return "status pending";
  }
}

export default function MiniAdminTransactionsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  async function loadRecords() {
    try {
      setError("");

      const response = await fetch(
        "/api/admin/transaction-records",
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load transaction records."
        );
      }

      setRecords(Array.isArray(data?.records) ? data.records : []);
    } catch (err) {
      setError(
        err?.message || "Unable to load transaction records."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();

    const interval = setInterval(loadRecords, 30000);

    return () => clearInterval(interval);
  }, []);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();

    return records.filter((record) => {
      const status = String(
        record?.withdrawal_status ||
          record?.status ||
          ""
      ).toLowerCase();

      const matchesFilter =
        filter === "all" ||
        (filter === "pending" &&
          ["pending"].includes(status)) ||
        (filter === "processing" &&
          ["processing"].includes(status)) ||
        (filter === "paid" &&
          ["paid", "successful"].includes(status)) ||
        (filter === "rejected" &&
          ["rejected", "failed"].includes(status));

      if (!matchesFilter) return false;

      if (!term) return true;

      const searchable = [
        record?.reference,
        record?.transaction_id,
        record?.withdrawal_order_id,
        record?.phone,
        record?.name,
        record?.full_name,
        record?.username,
        record?.staff_name,
        record?.staff_login,
        record?.payment_reference,
        record?.description,
        record?.type,
        record?.entry_type,
        record?.withdrawal_status,
        record?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [records, search, filter]);

  const counts = useMemo(() => {
    const result = {
      all: records.length,
      pending: 0,
      processing: 0,
      paid: 0,
      rejected: 0,
    };

    for (const record of records) {
      const status = String(
        record?.withdrawal_status ||
          record?.status ||
          ""
      ).toLowerCase();

      if (status === "pending") result.pending += 1;
      if (status === "processing") result.processing += 1;
      if (status === "paid" || status === "successful") {
        result.paid += 1;
      }
      if (status === "rejected" || status === "failed") {
        result.rejected += 1;
      }
    }

    return result;
  }, [records]);

  return (
    <main className="page">
      <div className="topbar">
        <div>
          <h1>Transaction Records</h1>
          <p>
            Accumulated withdrawal and financial transaction history.
          </p>
        </div>

        <div className="actions">
          <button
            type="button"
            className="refresh"
            onClick={() => {
              setLoading(true);
              loadRecords();
            }}
          >
            Refresh
          </button>

          <Link href="/mini-admin" className="back">
            ← Withdrawal Queue
          </Link>
        </div>
      </div>

      <section className="summary">
        <button
          type="button"
          className={filter === "all" ? "summary-card active" : "summary-card"}
          onClick={() => setFilter("all")}
        >
          <span>Total</span>
          <strong>{counts.all}</strong>
        </button>

        <button
          type="button"
          className={
            filter === "pending"
              ? "summary-card active"
              : "summary-card"
          }
          onClick={() => setFilter("pending")}
        >
          <span>Pending</span>
          <strong>{counts.pending}</strong>
        </button>

        <button
          type="button"
          className={
            filter === "processing"
              ? "summary-card active"
              : "summary-card"
          }
          onClick={() => setFilter("processing")}
        >
          <span>Processing</span>
          <strong>{counts.processing}</strong>
        </button>

        <button
          type="button"
          className={
            filter === "paid"
              ? "summary-card active"
              : "summary-card"
          }
          onClick={() => setFilter("paid")}
        >
          <span>Paid</span>
          <strong>{counts.paid}</strong>
        </button>

        <button
          type="button"
          className={
            filter === "rejected"
              ? "summary-card active"
              : "summary-card"
          }
          onClick={() => setFilter("rejected")}
        >
          <span>Rejected</span>
          <strong>{counts.rejected}</strong>
        </button>
      </section>

      <section className="toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search WD, member, phone, staff, payment reference..."
        />

        <span>
          Showing {filteredRecords.length} record
          {filteredRecords.length === 1 ? "" : "s"}
        </span>
      </section>

      {error ? (
        <div className="error">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="empty">
          Loading transaction records...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty">
          No transaction records found.
        </div>
      ) : (
        <section className="records">
          {filteredRecords.map((record, index) => {
            const status =
              record?.withdrawal_status ||
              record?.status ||
              "pending";

            const name =
              record?.name ||
              record?.full_name ||
              record?.username ||
              "Member";

            const gross =
              record?.gross_amount ??
              record?.amount ??
              0;

            const fee = record?.fee_amount ?? 0;

            const net =
              record?.net_amount ??
              (Number(gross) - Number(fee));

            const reference =
              record?.reference ||
              (record?.withdrawal_order_id
                ? `WD-${record.withdrawal_order_id}`
                : "—");

            const staff =
              record?.staff_name ||
              record?.processor_name ||
              record?.claimed_by_name ||
              "—";

            return (
              <article
                className="record"
                key={
                  record?.withdrawal_order_id ||
                  record?.transaction_id ||
                  record?.id ||
                  `${reference}-${index}`
                }
              >
                <div className="record-head">
                  <div>
                    <strong>{reference}</strong>
                    <small>
                      {dateTime(
                        record?.created_at ||
                          record?.transaction_created_at
                      )}
                    </small>
                  </div>

                  <span className={statusClass(status)}>
                    {statusLabel(status)}
                  </span>
                </div>

                <div className="grid">
                  <div>
                    <label>Member</label>
                    <strong>{name}</strong>
                  </div>

                  <div>
                    <label>Phone</label>
                    <strong>
                      {record?.phone || "—"}
                    </strong>
                  </div>

                  <div>
                    <label>Gross Amount</label>
                    <strong>
                      {money(gross)}
                    </strong>
                  </div>

                  <div>
                    <label>Fee</label>
                    <strong>
                      {money(fee)}
                    </strong>
                  </div>

                  <div>
                    <label>Net Amount</label>
                    <strong>
                      {money(net)}
                    </strong>
                  </div>

                  {record?.type === "deposit" ? (
                    <>
                      <div>
                        <label>Payment Phone</label>
                        <strong>
                          {record?.payment_phone ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <label>
                          Name on Payment Account
                        </label>
                        <strong>
                          {record?.payment_sender_name ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <label>Network</label>
                        <strong>
                          {record?.payment_network ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <label>Payment Number</label>
                        <strong>
                          {record?.payment_account ||
                            record?.account_number ||
                            record?.payment_number ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <label>Recipient</label>
                        <strong>
                          {record?.recipient_name ||
                            record?.recipient ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <label>Assigned Staff</label>
                        <strong>
                          {record?.assigned_staff_name ||
                            record?.staff_name ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <label>Payment Submitted</label>
                        <strong>
                          {dateTime(
                            record?.payment_submitted_at ||
                              record?.payment_sent_at
                          )}
                        </strong>
                      </div>

                      <div>
                        <label>Verified</label>
                        <strong>
                          {dateTime(
                            record?.verified_at ||
                              record?.processed_at
                          )}
                        </strong>
                      </div>
                    </>
                  ) : record?.type === "withdrawal" ? (
                    <>
                      <div>
                        <label>Processor</label>
                        <strong>{staff}</strong>
                      </div>

                      <div>
                        <label>Payment Reference</label>
                        <strong>
                          {record?.payment_reference ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <label>Payment Sent</label>
                        <strong>
                          {dateTime(
                            record?.payment_sent_at
                          )}
                        </strong>
                      </div>

                      <div>
                        <label>Processed</label>
                        <strong>
                          {dateTime(
                            record?.processed_at
                          )}
                        </strong>
                      </div>

                      <div>
                        <label>Rejection Reason</label>
                        <strong>
                          {record?.rejection_reason ||
                            "—"}
                        </strong>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label>Description</label>
                      <strong>
                        {record?.description || "—"}
                      </strong>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #f5f7fb;
    color: #111827;
    font-family: Arial, Helvetica, sans-serif;
  }

  button,
  input {
    font: inherit;
  }

  .page {
    width: min(1180px, calc(100% - 28px));
    margin: 0 auto;
    padding: 28px 0 50px;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: flex-start;
    margin-bottom: 22px;
  }

  h1 {
    margin: 0 0 7px;
    font-size: 28px;
  }

  p {
    margin: 0;
    color: #6b7280;
  }

  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .refresh,
  .back {
    border: 0;
    border-radius: 10px;
    padding: 11px 15px;
    cursor: pointer;
    text-decoration: none;
  }

  .refresh {
    background: #111827;
    color: white;
  }

  .back {
    background: white;
    color: #111827;
    border: 1px solid #d1d5db;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    margin-bottom: 18px;
  }

  .summary-card {
    text-align: left;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 17px;
    cursor: pointer;
  }

  .summary-card.active {
    border-color: #111827;
    box-shadow: 0 0 0 1px #111827;
  }

  .summary-card span {
    display: block;
    color: #6b7280;
    font-size: 13px;
    margin-bottom: 7px;
  }

  .summary-card strong {
    font-size: 24px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
  }

  .toolbar input {
    flex: 1;
    min-width: 0;
    padding: 13px 14px;
    border: 1px solid #d1d5db;
    border-radius: 11px;
    background: white;
    outline: none;
  }

  .toolbar span {
    color: #6b7280;
    white-space: nowrap;
    font-size: 14px;
  }

  .error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
    padding: 14px;
    border-radius: 11px;
    margin-bottom: 18px;
  }

  .empty {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 45px 20px;
    text-align: center;
    color: #6b7280;
  }

  .records {
    display: grid;
    gap: 14px;
  }

  .record {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 18px;
  }

  .record-head {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
    padding-bottom: 14px;
    margin-bottom: 15px;
    border-bottom: 1px solid #eef0f3;
  }

  .record-head strong {
    display: block;
    font-size: 16px;
  }

  .record-head small {
    display: block;
    margin-top: 5px;
    color: #6b7280;
  }

  .status {
    display: inline-flex;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 700;
  }

  .status.success {
    background: #ecfdf5;
    color: #047857;
  }

  .status.danger {
    background: #fef2f2;
    color: #b91c1c;
  }

  .status.processing {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .status.pending {
    background: #fffbeb;
    color: #a16207;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
  }

  .grid label {
    display: block;
    color: #6b7280;
    font-size: 12px;
    margin-bottom: 5px;
  }

  .grid strong {
    display: block;
    font-size: 14px;
    word-break: break-word;
  }

  @media (max-width: 800px) {
    .summary {
      grid-template-columns: repeat(2, 1fr);
    }

    .grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .topbar {
      flex-direction: column;
    }

    .toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .toolbar span {
      white-space: normal;
    }
  }

  @media (max-width: 520px) {
    .page {
      width: min(100% - 18px, 1180px);
      padding-top: 18px;
    }

    h1 {
      font-size: 23px;
    }

    .summary {
      grid-template-columns: 1fr 1fr;
    }

    .grid {
      grid-template-columns: 1fr;
    }

    .record-head {
      flex-direction: column;
    }
  }
`;

if (typeof document !== "undefined") {
  const styleId = "mini-admin-transactions-styles";

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = styles;
    document.head.appendChild(style);
  }
}
