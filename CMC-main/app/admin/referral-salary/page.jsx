"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function money(value) {
  return `GHS ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function statusLabel(status) {
  if (!status) return "Unknown";

  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function paymentStatusClass(status) {
  if (status === "paid") {
    return "salary-status salary-status-paid";
  }

  if (status === "pending") {
    return "salary-status salary-status-pending";
  }

  if (status === "skipped") {
    return "salary-status salary-status-skipped";
  }

  return "salary-status";
}

export default function ManagementSalaryAdmin() {
  const [summary, setSummary] = useState({
    totalContracts: 0,
    activeContracts: 0,
    terminatedContracts: 0,
    totalPayments: 0,
    paidPayments: 0,
    pendingPayments: 0,
    skippedPayments: 0,
    totalPaid: 0
  });

  const [contracts, setContracts] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [contractFilter, setContractFilter] =
    useState("all");
  const [paymentFilter, setPaymentFilter] =
    useState("all");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/referral-salary",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load management salary data."
        );
      }

      setSummary(
        data.summary || {
          totalContracts: 0,
          activeContracts: 0,
          terminatedContracts: 0,
          totalPayments: 0,
          paidPayments: 0,
          pendingPayments: 0,
          skippedPayments: 0,
          totalPaid: 0
        }
      );

      setContracts(
        Array.isArray(data.contracts)
          ? data.contracts
          : []
      );

      setPayments(
        Array.isArray(data.payments)
          ? data.payments
          : []
      );
    } catch (err) {
      console.error(
        "Management salary load failed:",
        err
      );

      setError(
        err.message ||
          "Unable to load management salary data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function evaluate() {
    setEvaluating(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/admin/referral-salary",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type":
              "application/json"
          }
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to evaluate salaries."
        );
      }

      const results =
        Array.isArray(data.results)
          ? data.results
          : [];

      const paid = results.filter(
        (item) =>
          item?.status === "paid"
      ).length;

      const alreadyPaid =
        results.filter(
          (item) =>
            item?.status ===
            "already_paid"
        ).length;

      const terminated =
        results.filter(
          (item) =>
            item?.status ===
            "terminated"
        ).length;

      const notReady =
        results.filter(
          (item) =>
            item?.status ===
            "not_ready"
        ).length;

      setMessage(
        `Evaluation completed. ${paid} payment(s) processed${
          alreadyPaid
            ? `, ${alreadyPaid} already paid`
            : ""
        }${
          terminated
            ? `, ${terminated} contract(s) terminated`
            : ""
        }${
          notReady
            ? `, ${notReady} contract(s) not ready`
            : ""
        }.`
      );

      await loadData();
    } catch (err) {
      console.error(
        "Salary evaluation failed:",
        err
      );

      setError(
        err.message ||
          "Unable to evaluate salaries."
      );
    } finally {
      setEvaluating(false);
    }
  }

  const filteredContracts = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    return contracts.filter((contract) => {
      const matchesSearch =
        !term ||
        String(
          contract.userName || ""
        )
          .toLowerCase()
          .includes(term) ||
        String(
          contract.phone || ""
        )
          .toLowerCase()
          .includes(term) ||
        String(
          contract.accountId || ""
        )
          .toLowerCase()
          .includes(term) ||
        String(
          contract.positionName || ""
        )
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        contractFilter === "all" ||
        contract.status ===
          contractFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    contracts,
    search,
    contractFilter
  ]);

  const filteredPayments = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesSearch =
        !term ||
        String(
          payment.userName || ""
        )
          .toLowerCase()
          .includes(term) ||
        String(
          payment.phone || ""
        )
          .toLowerCase()
          .includes(term) ||
        String(
          payment.accountId || ""
        )
          .toLowerCase()
          .includes(term) ||
        String(
          payment.positionName || ""
        )
          .toLowerCase()
          .includes(term) ||
        String(
          payment.transactionReference || ""
        )
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        paymentFilter === "all" ||
        payment.status ===
          paymentFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    payments,
    search,
    paymentFilter
  ]);

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>
          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Management Salary
          </h1>

          <p className="muted">
            Monitor management contracts,
            salary cycles and payments.
          </p>
        </div>

        <Link
          className="icon-button"
          href="/admin"
        >
          ←
        </Link>

      </header>

      <section className="admin-card">

        <div className="admin-card-head">

          <div>
            <strong>
              Salary Control
            </strong>

            <span className="muted">
              Evaluate contracts that are due.
            </span>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={evaluate}
            disabled={evaluating}
          >
            {evaluating
              ? "Evaluating..."
              : "Evaluate Due Salaries"}
          </button>

        </div>

        {message && (
          <div className="salary-message">
            {message}
          </div>
        )}

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

      </section>

      <section className="salary-summary-grid">

        <div className="stat-box">
          <span>
            Total Contracts
          </span>
          <strong>
            {summary.totalContracts}
          </strong>
        </div>

        <div className="stat-box">
          <span>
            Active
          </span>
          <strong>
            {summary.activeContracts}
          </strong>
        </div>

        <div className="stat-box">
          <span>
            Terminated
          </span>
          <strong>
            {summary.terminatedContracts}
          </strong>
        </div>

        <div className="stat-box">
          <span>
            Paid Payments
          </span>
          <strong>
            {summary.paidPayments}
          </strong>
        </div>

        <div className="stat-box">
          <span>
            Pending Payments
          </span>
          <strong>
            {summary.pendingPayments}
          </strong>
        </div>

        <div className="stat-box">
          <span>
            Total Salary Paid
          </span>
          <strong>
            {money(summary.totalPaid)}
          </strong>
        </div>

      </section>

      <section className="admin-card">

        <div className="admin-card-head">

          <div>
            <strong>
              Management Contracts
            </strong>

            <span className="muted">
              {filteredContracts.length} shown
            </span>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={loadData}
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

        </div>

        <div className="salary-filter-row">

          <input
            className="admin-input"
            type="search"
            placeholder="Search name, phone, account or position"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

          <select
            className="admin-input"
            value={contractFilter}
            onChange={(event) =>
              setContractFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Contracts
            </option>
            <option value="active">
              Active
            </option>
            <option value="terminated">
              Terminated
            </option>
            <option value="completed">
              Completed
            </option>
          </select>

        </div>

        {loading ? (
          <p className="muted">
            Loading management contracts...
          </p>
        ) : filteredContracts.length === 0 ? (
          <p className="muted">
            No management contracts match
            your search.
          </p>
        ) : (
          <div className="salary-list">

            {filteredContracts.map(
              (contract) => (
                <article
                  className="salary-contract-card"
                  key={contract.id}
                >

                  <div className="salary-contract-head">

                    <div>
                      <strong>
                        {contract.userName}
                      </strong>

                      <span className="muted">
                        {contract.phone}
                        {contract.accountId
                          ? ` · ${contract.accountId}`
                          : ""}
                      </span>
                    </div>

                    <span
                      className={
                        contract.status ===
                        "active"
                          ? "salary-status salary-status-paid"
                          : "salary-status"
                      }
                    >
                      {statusLabel(
                        contract.status
                      )}
                    </span>

                  </div>

                  <div className="salary-contract-position">

                    <strong>
                      {contract.positionName}
                    </strong>

                    <span className="muted">
                      {money(
                        contract.salaryAmount
                      )}
                      {" / "}
                      {contract.paymentIntervalMonths}
                      {" month"}
                      {contract.paymentIntervalMonths ===
                      1
                        ? ""
                        : "s"}
                    </span>

                  </div>

                  <div className="salary-contract-grid">

                    <div>
                      <span>
                        Required Members
                      </span>
                      <strong>
                        {contract.requiredMembers}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Qualifying Members
                      </span>
                      <strong>
                        {
                          contract.qualifyingMemberCount
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Payments Received
                      </span>
                      <strong>
                        {
                          contract.paymentsReceived
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total Paid
                      </span>
                      <strong>
                        {money(
                          contract.totalPaid
                        )}
                      </strong>
                    </div>

                  </div>

                  <div className="salary-contract-dates">

                    <div>
                      <span>
                        Started
                      </span>
                      <strong>
                        {formatDate(
                          contract.startedAt
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Next Payment
                      </span>
                      <strong>
                        {formatDate(
                          contract.nextPaymentAt
                        )}
                      </strong>
                    </div>

                  </div>

                </article>
              )
            )}

          </div>
        )}

      </section>

      <section className="admin-card">

        <div className="admin-card-head">

          <div>
            <strong>
              Salary Payment History
            </strong>

            <span className="muted">
              {filteredPayments.length} payment record
              {filteredPayments.length === 1
                ? ""
                : "s"}
            </span>
          </div>

          <select
            className="admin-input salary-small-select"
            value={paymentFilter}
            onChange={(event) =>
              setPaymentFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Payments
            </option>
            <option value="paid">
              Paid
            </option>
            <option value="pending">
              Pending
            </option>
            <option value="skipped">
              Skipped
            </option>
          </select>

        </div>

        {loading ? (
          <p className="muted">
            Loading payment history...
          </p>
        ) : filteredPayments.length === 0 ? (
          <p className="muted">
            No salary payments match your
            search.
          </p>
        ) : (
          <div className="salary-list">

            {filteredPayments.map(
              (payment) => (
                <article
                  className="salary-payment-card"
                  key={payment.id}
                >

                  <div className="salary-payment-head">

                    <div>
                      <strong>
                        {payment.userName}
                      </strong>

                      <span className="muted">
                        {payment.phone}
                        {" · "}
                        {payment.positionName}
                      </span>
                    </div>

                    <span
                      className={paymentStatusClass(
                        payment.status
                      )}
                    >
                      {statusLabel(
                        payment.status
                      )}
                    </span>

                  </div>

                  <div className="salary-payment-main">

                    <div>
                      <span>
                        Payment
                      </span>
                      <strong>
                        #{payment.cycleNumber}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Amount
                      </span>
                      <strong>
                        {money(
                          payment.amount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Scheduled
                      </span>
                      <strong>
                        {formatDate(
                          payment.scheduledAt
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Paid
                      </span>
                      <strong>
                        {formatDate(
                          payment.paidAt
                        )}
                      </strong>
                    </div>

                  </div>

                  {payment.transactionReference && (
                    <div className="salary-transaction">

                      <span>
                        Transaction
                      </span>

                      <strong>
                        {payment.transactionReference}
                      </strong>

                      <span className="muted">
                        {payment.transactionStatus
                          ? statusLabel(
                              payment.transactionStatus
                            )
                          : "—"}
                      </span>

                    </div>
                  )}

                </article>
              )
            )}

          </div>
        )}

      </section>

      <section className="admin-card">

        <strong>
          Management Salary Rules
        </strong>

        <p className="muted">
          Salary amount, required members and
          payment interval are controlled from
          Management Positions.
        </p>

        <p className="muted">
          Payments 1 and 2 can proceed when the
          configured position requirements are
          satisfied.
        </p>

        <p className="muted">
          Starting with payment 3, the system
          requires continued qualifying-member
          growth. If that condition fails, the
          management contract is terminated and
          the salary payment is skipped.
        </p>

        <p className="muted">
          Payment processing is protected against
          duplicate payment for the same contract
          cycle.
        </p>

        <Link
          className="primary-button"
          href="/admin/management-positions"
        >
          Open Management Positions
        </Link>

      </section>

    </main>
  );
}
