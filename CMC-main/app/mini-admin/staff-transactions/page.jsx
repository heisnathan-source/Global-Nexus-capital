"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateTime(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function periodLabel(period) {
  return {
    today: "Today",
    week: "This Week",
    month: "This Month",
    year: "This Year",
  }[period] || "Today";
}

function StatusBadge({ excluded }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: ".02em",
        background: excluded
          ? "#fff1f2"
          : "#ecfdf3",
        color: excluded
          ? "#be123c"
          : "#047857",
        border: excluded
          ? "1px solid #fecdd3"
          : "1px solid #bbf7d0",
      }}
    >
      {excluded
        ? "EXCLUDED FROM REPORT"
        : "INCLUDED"}
    </span>
  );
}

function Empty({ children }) {
  return (
    <div
      style={{
        padding: "28px 16px",
        textAlign: "center",
        color: "#64748b",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

export default function MiniStaffTransactions() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("today");
    const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
  params.set("period", period);

  if (search) {
    params.set("search", search);
  }

  const response = await fetch(
    `/api/admin/staff-transactions?${params.toString()}`,
    {
      cache: "no-store",
    }
  );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to load staff reports."
        );
      }

      setData(result);
    } catch (e) {
      setError(
        e?.message ||
          "Unable to load staff reports."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [period, search]);

  async function changeReportingStatus(
    transactionType,
    transactionId,
    currentlyExcluded
  ) {
    const nextExcluded =
      !currentlyExcluded;

    let reason = "";

    if (nextExcluded) {
      reason = window.prompt(
        "Enter a reason for excluding this transaction from Staff Reports:"
      );

      if (!reason || !reason.trim()) {
        return;
      }
    } else {
      const confirmed =
        window.confirm(
          "Include this transaction in Staff Reports again?"
        );

      if (!confirmed) return;

      reason =
        "Transaction included in Staff Reports.";
    }

    const key =
      `${transactionType}:${transactionId}`;

    setWorking(key);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/staff-transaction-reporting",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionType,
            transactionId,
            excluded: nextExcluded,
            reason,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to update reporting status."
        );
      }

      await load();
    } catch (e) {
      setError(
        e?.message ||
          "Unable to update reporting status."
      );
    } finally {
      setWorking("");
    }
  }

  const summary =
    data?.reportedSummary ||
    data?.summary ||
    {};

  const staffTotals =
    data?.staffTotals || [];

  const deposits =
    data?.deposits || [];

  const withdrawals =
    data?.withdrawals || [];

  const viewer =
    data?.viewer || {};

  return (
    <main
      className="mobile-shell scroll-page"
      style={{
        background:
          "linear-gradient(180deg,#f8fafc 0%,#eef2f7 100%)",
        minHeight: "100vh",
      }}
    >
      <header
        className="topbar"
        style={{
          marginBottom: 14,
        }}
      >
        <div>
          <div
            className="eyebrow"
            style={{
              letterSpacing: ".08em",
            }}
          >
            Global Nexus Capital VERIFICATION
          </div>

          <h1
            style={{
              marginBottom: 5,
            }}
          >
            Staff Transaction Reports
          </h1>

          <p
            className="muted"
            style={{
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Shared staff activity report
          </p>
        </div>

        <Link
          className="icon-button"
          href="/mini-admin"
          aria-label="Back"
        >
          ←
        </Link>
      </header>

      {error ? (
        <section
          className="admin-card"
          style={{
            border:
              "1px solid #fecdd3",
            background: "#fff1f2",
            marginBottom: 12,
          }}
        >
          <strong
            style={{ color: "#be123c" }}
          >
            Unable to update report
          </strong>

          <p
            style={{
              color: "#9f1239",
              marginBottom: 0,
              fontSize: 13,
            }}
          >
            {error}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <strong>Report Period</strong>

            <div
              className="muted"
              style={{
                fontSize: 12,
                marginTop: 3,
              }}
            >
              Showing {periodLabel(period)}
            </div>
          </div>

          <span className="badge">
            {periodLabel(period)}
          </span>
        </div>

        <select
          value={period}
          onChange={(e) =>
            setPeriod(e.target.value)
          }
          style={{
            width: "100%",
          }}
        >
          <option value="today">
            Today
          </option>
          <option value="week">
            This Week
          </option>
          <option value="month">
            This Month
          </option>
          <option value="year">
            This Year
          </option>
        </select>
      </section>
  
  <section
    className="admin-card"
    style={{
      marginBottom: 12,
    }}
  >
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSearch(searchInput.trim());
      }}
      style={{
        display: "grid",
        gap: 9,
      }}
    >
      <div>
        <strong
          style={{
            display: "block",
            marginBottom: 4,
          }}
        >
          Deposit Search
        </strong>

        <div
          className="muted"
          style={{
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          Search deposits by Order Number, payment phone number, or the name on the payment account.
        </div>
      </div>

      <input
        type="search"
        value={searchInput}
        onChange={(e) =>
          setSearchInput(e.target.value)
        }
        placeholder="Order number, payment phone or sender name"
        autoComplete="off"
        style={{
          width: "100%",
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #0f172a",
            background: "#0f172a",
            color: "#fff",
            fontWeight: 750,
            fontSize: 12,
          }}
        >
          Search Deposits
        </button>

        <button
          type="button"
          onClick={() => {
            setSearchInput("");
            setSearch("");
          }}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#fff",
            fontWeight: 750,
            fontSize: 12,
          }}
        >
          Clear Search
        </button>
      </div>

      <div
        style={{
          padding: "8px 10px",
          borderRadius: 9,
          background: "#f8fafc",
          color: "#64748b",
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        Search does not use the member&apos;s registered Global Nexus Capital account number.
      </div>

      {search ? (
        <div
          style={{
            fontSize: 11,
            color: "#1e40af",
            fontWeight: 700,
          }}
        >
          Active deposit search: &quot;{search}&quot;
        </div>
      ) : null}
    </form>
  </section>


      {viewer.staffReportExclusionEnabled ? (
        <section
          style={{
            padding: "11px 13px",
            borderRadius: 13,
            background: "#eff6ff",
            border:
              "1px solid #bfdbfe",
            marginBottom: 12,
            color: "#1e40af",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <strong>
            Staff Report Exclusion is enabled
          </strong>

          <div>
            You can exclude your own handled
            transactions from the accumulated
            Staff Report. The financial record
            itself is not deleted.
          </div>
        </section>
      ) : null}

      {loading && !data ? (
        <section className="admin-card">
          <Empty>
            Loading staff reports...
          </Empty>
        </section>
      ) : (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              className="admin-card"
              style={{
                margin: 0,
                padding: 15,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                INCLUDED RECORDS
              </div>

              <div
                style={{
                  fontSize: 25,
                  fontWeight: 850,
                  lineHeight: 1,
                }}
              >
                {summary.record_count ||
                  0}
              </div>

              <div
                className="muted"
                style={{
                  fontSize: 11,
                  marginTop: 7,
                }}
              >
                Accumulated report
              </div>
            </div>

            <div
              className="admin-card"
              style={{
                margin: 0,
                padding: 15,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                STAFF MEMBERS
              </div>

              <div
                style={{
                  fontSize: 25,
                  fontWeight: 850,
                  lineHeight: 1,
                }}
              >
                {data?.staff?.length ||
                  0}
              </div>

              <div
                className="muted"
                style={{
                  fontSize: 11,
                  marginTop: 7,
                }}
              >
                Verification staff
              </div>
            </div>
          </section>

          <section
            className="admin-card"
            style={{
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <div>
                <strong>
                  Report Overview
                </strong>

                <div
                  className="muted"
                  style={{
                    fontSize: 12,
                    marginTop: 3,
                  }}
                >
                  Included transactions only
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2,minmax(0,1fr))",
                gap: 10,
              }}
            >
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    marginBottom: 5,
                  }}
                >
                  VERIFIED DEPOSITS
                </div>

                <strong>
                  {summary.deposit_count ||
                    0}
                </strong>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  GHS{" "}
                  {money(
                    summary.deposit_amount
                  )}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    marginBottom: 5,
                  }}
                >
                  PAID WITHDRAWALS
                </div>

                <strong>
                  {summary.withdrawal_count ||
                    0}
                </strong>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  GHS{" "}
                  {money(
                    summary.withdrawal_net
                  )}
                </div>
              </div>
            </div>
          </section>

          <section
            className="admin-card"
            style={{
              marginBottom: 12,
            }}
          >
            <div
              style={{
                marginBottom: 12,
              }}
            >
              <strong>
                Staff Summary
              </strong>

              <div
                className="muted"
                style={{
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Included activity by staff member
              </div>
            </div>

            {staffTotals.length === 0 ? (
              <Empty>
                No staff activity for this period.
              </Empty>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 9,
                }}
              >
                {staffTotals.map(
                  (staff) => (
                    <div
                      key={staff.staff_id}
                      style={{
                        padding: 13,
                        border:
                          "1px solid #e2e8f0",
                        borderRadius: 13,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: 10,
                        }}
                      >
                        <div>
                          <strong>
                            {staff.staff_name}
                          </strong>

                          {staff.staff_login ? (
                            <div
                              className="muted"
                              style={{
                                fontSize: 11,
                                marginTop: 2,
                              }}
                            >
                              {staff.staff_login}
                            </div>
                          ) : null}
                        </div>

                        <span className="badge">
                          {(
                            staff.deposit_count +
                            staff.withdrawal_count
                          )}{" "}
                          records
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "1fr 1fr",
                          gap: 8,
                          marginTop: 10,
                        }}
                      >
                        <div
                          style={{
                            padding: 9,
                            background:
                              "#f8fafc",
                            borderRadius: 9,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: "#64748b",
                            }}
                          >
                            DEPOSITS
                          </div>

                          <strong
                            style={{
                              fontSize: 13,
                            }}
                          >
                            {staff.deposit_count}
                          </strong>

                          <div
                            style={{
                              fontSize: 11,
                              marginTop: 2,
                            }}
                          >
                            GHS{" "}
                            {money(
                              staff.deposit_amount
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: 9,
                            background:
                              "#f8fafc",
                            borderRadius: 9,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: "#64748b",
                            }}
                          >
                            WITHDRAWALS
                          </div>

                          <strong
                            style={{
                              fontSize: 13,
                            }}
                          >
                            {staff.withdrawal_count}
                          </strong>

                          <div
                            style={{
                              fontSize: 11,
                              marginTop: 2,
                            }}
                          >
                            GHS{" "}
                            {money(
                              staff.withdrawal_net
                            )}
                          </div>
                        </div>
                      </div>

                      {(
                        staff.excluded_deposit_count +
                        staff.excluded_withdrawal_count
                      ) > 0 ? (
                        <div
                          style={{
                            marginTop: 9,
                            fontSize: 11,
                            color: "#be123c",
                          }}
                        >
                          {
                            staff.excluded_deposit_count
                          }{" "}
                          deposit(s) +{" "}
                          {
                            staff.excluded_withdrawal_count
                          }{" "}
                          withdrawal(s) excluded
                        </div>
                      ) : null}
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          <section
            className="admin-card"
            style={{
              marginBottom: 12,
            }}
          >
            <div
              style={{
                marginBottom: 12,
              }}
            >
              <strong>
                Verified Deposits
              </strong>

              <div
                className="muted"
                style={{
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Deposits attributed to verification staff
              </div>
            </div>

            {deposits.length === 0 ? (
              <Empty>
                {search ? `No verified deposits matched &quot;${search}&quot;.` : "No verified deposits for this period."}
              </Empty>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                {deposits.map(
                  (row) => {
                    const key =
                      `deposit:${row.id}`;

                    return (
                      <div
                        key={key}
                        style={{
                          padding: 14,
                          border:
                            "1px solid #e2e8f0",
                          borderRadius: 14,
                          background: row.excluded_from_staff_reports
                            ? "#fff7f8"
                            : "#fff",
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
                            <strong
                              style={{
                                fontSize: 15,
                              }}
                            >
                              GHS{" "}
                              {money(
                                row.amount
                              )}
                            </strong>

                            <div
                              className="muted"
                              style={{
                                fontSize: 11,
                                marginTop: 3,
                              }}
                            >
                              {row.member_name ||
                                "Member"}
                            </div>
                          </div>

                          <StatusBadge
                            excluded={
                              row.excluded_from_staff_reports
                            }
                          />
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "1fr 1fr",
                            gap: 7,
                            marginTop: 12,
                            fontSize: 11,
                          }}
                        >
                          <div>
                            <span className="muted">
                              Staff
                            </span>
                            <br />
                            <strong>
                              {row.staff_name ||
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span className="muted">
                              Account
                            </span>
                            <br />
                            <strong>
                              {row.account_id ||
                                row.phone ||
                                row.phone_number ||
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span className="muted">
                              Payment
                            </span>
                            <br />
                            <strong>
                              {row.payment_account ||
                                "—"}
                            </strong>
                          </div>
        <div>
          <span className="muted">
            Payment Phone
          </span>
          <br />
          <strong>
            {row.payment_phone ||
              "—"}
          </strong>
        </div>
        <div>
          <span className="muted">
            Name on Payment Account
          </span>
          <br />
          <strong>
            {row.payment_sender_name ||
              "—"}
          </strong>
        </div>
        <div>
          <span className="muted">
            Order Number
          </span>
          <br />
          <strong>
            {row.id ||
              "—"}
          </strong>
        </div>

                          <div>
                            <span className="muted">
                              Verified
                            </span>
                            <br />
                            <strong>
                              {dateTime(
                                row.verified_at
                              )}
                            </strong>
                          </div>
                        </div>

                        {row.excluded_from_staff_reports &&
                        row.exclusion_reason ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 9,
                              borderRadius: 9,
                              background:
                                "#fff1f2",
                              color:
                                "#9f1239",
                              fontSize: 11,
                            }}
                          >
                            <strong>
                              Exclusion reason:
                            </strong>{" "}
                            {
                              row.exclusion_reason
                            }
                          </div>
                        ) : null}

                        {row.can_change_reporting_status ? (
                          <button
                            type="button"
                            disabled={
                              working === key
                            }
                            onClick={() =>
                              changeReportingStatus(
                                "deposit",
                                row.id,
                                row.excluded_from_staff_reports
                              )
                            }
                            style={{
                              width: "100%",
                              marginTop: 11,
                              padding:
                                "10px 12px",
                              borderRadius: 10,
                              border:
                                "1px solid #cbd5e1",
                              background:
                                "#fff",
                              fontWeight: 750,
                              fontSize: 12,
                              cursor:
                                working === key
                                  ? "wait"
                                  : "pointer",
                            }}
                          >
                            {working === key
                              ? "Updating..."
                              : row.excluded_from_staff_reports
                              ? "Include in Staff Reports"
                              : "Exclude from Staff Reports"}
                          </button>
                        ) : null}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>

          <section
            className="admin-card"
            style={{
              marginBottom: 20,
            }}
          >
            <div
              style={{
                marginBottom: 12,
              }}
            >
              <strong>
                Paid Withdrawals
              </strong>

              <div
                className="muted"
                style={{
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Withdrawals attributed to the processing staff member
              </div>
            </div>

            {withdrawals.length === 0 ? (
              <Empty>
                No paid withdrawals for this period.
              </Empty>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                {withdrawals.map(
                  (row) => {
                    const key =
                      `withdrawal:${row.id}`;

                    return (
                      <div
                        key={key}
                        style={{
                          padding: 14,
                          border:
                            "1px solid #e2e8f0",
                          borderRadius: 14,
                          background: row.excluded_from_staff_reports
                            ? "#fff7f8"
                            : "#fff",
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
                            <strong
                              style={{
                                fontSize: 15,
                              }}
                            >
                              GHS{" "}
                              {money(
                                row.net_amount
                              )}
                            </strong>

                            <div
                              className="muted"
                              style={{
                                fontSize: 11,
                                marginTop: 3,
                              }}
                            >
                              Net amount
                            </div>
                          </div>

                          <StatusBadge
                            excluded={
                              row.excluded_from_staff_reports
                            }
                          />
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "1fr 1fr",
                            gap: 7,
                            marginTop: 12,
                            fontSize: 11,
                          }}
                        >
                          <div>
                            <span className="muted">
                              Member
                            </span>
                            <br />
                            <strong>
                              {row.member_name ||
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span className="muted">
                              Staff
                            </span>
                            <br />
                            <strong>
                              {row.staff_name ||
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span className="muted">
                              Gross
                            </span>
                            <br />
                            <strong>
                              GHS{" "}
                              {money(
                                row.gross_amount
                              )}
                            </strong>
                          </div>

                          <div>
                            <span className="muted">
                              Fee
                            </span>
                            <br />
                            <strong>
                              GHS{" "}
                              {money(
                                row.fee_amount
                              )}
                            </strong>
                          </div>

                          <div>
                            <span className="muted">
                              Reference
                            </span>
                            <br />
                            <strong>
                              {row.payment_reference ||
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span className="muted">
                              Paid
                            </span>
                            <br />
                            <strong>
                              {dateTime(
                                row.payment_sent_at ||
                                  row.processed_at
                              )}
                            </strong>
                          </div>
                        </div>

                        {row.excluded_from_staff_reports &&
                        row.exclusion_reason ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 9,
                              borderRadius: 9,
                              background:
                                "#fff1f2",
                              color:
                                "#9f1239",
                              fontSize: 11,
                            }}
                          >
                            <strong>
                              Exclusion reason:
                            </strong>{" "}
                            {
                              row.exclusion_reason
                            }
                          </div>
                        ) : null}

                        {row.can_change_reporting_status ? (
                          <button
                            type="button"
                            disabled={
                              working === key
                            }
                            onClick={() =>
                              changeReportingStatus(
                                "withdrawal",
                                row.id,
                                row.excluded_from_staff_reports
                              )
                            }
                            style={{
                              width: "100%",
                              marginTop: 11,
                              padding:
                                "10px 12px",
                              borderRadius: 10,
                              border:
                                "1px solid #cbd5e1",
                              background:
                                "#fff",
                              fontWeight: 750,
                              fontSize: 12,
                              cursor:
                                working === key
                                  ? "wait"
                                  : "pointer",
                            }}
                          >
                            {working === key
                              ? "Updating..."
                              : row.excluded_from_staff_reports
                              ? "Include in Staff Reports"
                              : "Exclude from Staff Reports"}
                          </button>
                        ) : null}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
