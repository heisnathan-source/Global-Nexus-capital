"use client";

import { useEffect, useState } from "react";

const periods = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "Week" },
  { key: "monthly", label: "Month" },
  { key: "yearly", label: "Year" }
];

function money(value) {
  return `GHS ${Number(value || 0).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  )}`;
}

function transactionLabel(type) {
  return String(type || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default function FinancialAnalyticsPage() {
  const [period, setPeriod] =
    useState("daily");

  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadAnalytics(
    selectedPeriod = period
  ) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/financial-analytics?period=${selectedPeriod}`,
        {
          cache: "no-store"
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Unable to load financial analytics."
        );
      }

      setData(result);

    } catch (err) {

      setError(
        err.message ||
        "Unable to load financial analytics."
      );

    } finally {

      setLoading(false);

    }
  }

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  function changePeriod(nextPeriod) {
    setPeriod(nextPeriod);
  }

  const summary =
    data?.summary || {};

  const overall =
    Number(
      summary.overallOperationalPosition || 0
    );

  const external =
    Number(
      summary.externalCashPosition || 0
    );

  const positionText =
    overall > 0
      ? "Global Nexus Capital funds increased"
      : overall < 0
        ? "Global Nexus Capital funds decreased"
        : "Global Nexus Capital funds are balanced";

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>

          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Financial Analytics
          </h1>

          <p className="muted">
            Monitor money entering, leaving and moving within Global Nexus Capital.
          </p>

        </div>

      </header>


      <section className="admin-card">

        <div className="section-heading">

          <strong>
            Financial Period
          </strong>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              loadAnalytics(period)
            }
            disabled={loading}
          >
            Refresh
          </button>

        </div>


        <div className="setting-grid">

          {periods.map((item) => (

            <button
              key={item.key}
              type="button"
              className={
                period === item.key
                  ? "primary-button"
                  : "secondary-button"
              }
              onClick={() =>
                changePeriod(item.key)
              }
              disabled={loading}
            >
              {item.label}
            </button>

          ))}

        </div>

      </section>


      {error && (

        <section className="admin-card">

          <p className="auth-error">
            {error}
          </p>

        </section>

      )}


      {loading ? (

        <section className="admin-card">

          <div className="empty-document">

            <span>
              Loading financial data...
            </span>

          </div>

        </section>

      ) : (

        <>

          {/* OVERALL POSITION */}

          <section className="admin-card">

            <div className="section-heading">

              <strong>
                Overall Global Nexus Capital Position
              </strong>

              <span className="badge">

                {summary.positionStatus === "increased"
                  ? "INCREASED"
                  : summary.positionStatus === "decreased"
                    ? "DECREASED"
                    : "BALANCED"}

              </span>

            </div>


            <div className="balance-card">

              <span>
                {positionText}
              </span>

              <strong>
                {money(Math.abs(overall))}
              </strong>

            </div>


            <p className="muted">

              This combines external cash flow and
              internal wallet movement for the selected period.

            </p>

          </section>


          {/* EXTERNAL CASH FLOW */}

          <section className="admin-card">

            <div className="admin-card-head">

              <strong>
                External Cash Flow
              </strong>

              <span className="muted">
                Deposits & Withdrawals
              </span>

            </div>


            <div className="mine-stat-grid">

              <div>

                <span>
                  Money Entered
                </span>

                <strong>
                  {money(summary.moneyEntered)}
                </strong>

              </div>


              <div>

                <span>
                  Money Left
                </span>

                <strong>
                  {money(summary.moneyLeft)}
                </strong>

              </div>

            </div>


            <div className="list-row">

              <div>

                <strong>
                  Net External Position
                </strong>

                <span className="muted">

                  {external > 0
                    ? "More money entered Global Nexus Capital"
                    : external < 0
                      ? "More money left Global Nexus Capital"
                      : "External cash flow is balanced"}

                </span>

              </div>


              <strong>
                {money(Math.abs(external))}
              </strong>

            </div>

          </section>


          {/* INTERNAL MOVEMENT */}

          <section className="admin-card">

            <div className="admin-card-head">

              <strong>
                Internal Movement
              </strong>

              <span className="muted">
                Wallet activity
              </span>

            </div>


            <div className="mine-stat-grid">

              <div>

                <span>
                  Internal Credits
                </span>

                <strong>
                  {money(summary.internalCredits)}
                </strong>

              </div>


              <div>

                <span>
                  Internal Debits
                </span>

                <strong>
                  {money(summary.internalDebits)}
                </strong>

              </div>

            </div>


            <div className="list-row">

              <div>

                <strong>
                  Net Internal Effect
                </strong>

                <span className="muted">
                  Internal wallet movement during this period
                </span>

              </div>


              <strong>
                {money(
                  Math.abs(
                    summary.netInternalWalletMovement
                  )
                )}
              </strong>

            </div>

          </section>


          {/* QUICK SUMMARY */}

          <section className="admin-card">

            <div className="admin-card-head">

              <strong>
                Quick Summary
              </strong>

            </div>


            <div className="list-row">

              <div>

                <strong>
                  Cash Flow Status
                </strong>

                <span className="muted">

                  {summary.cashFlowStatus ===
                  "more_entering"
                    ? "More money is entering Global Nexus Capital"
                    : summary.cashFlowStatus ===
                      "more_leaving"
                      ? "More money is leaving Global Nexus Capital"
                      : "Money entering and leaving is balanced"}

                </span>

              </div>

            </div>


            <div className="list-row">

              <div>

                <strong>
                  Total Transactions
                </strong>

                <span className="muted">
                  All successful transactions
                </span>

              </div>


              <strong>
                {data?.transactionCount || 0}
              </strong>

            </div>

          </section>


          {/* TRANSACTION BREAKDOWN */}

          <section className="admin-card">

            <div className="admin-card-head">

              <strong>
                Transaction Breakdown
              </strong>

              <span className="badge">

                {data?.breakdown?.length || 0}

              </span>

            </div>


            {!data?.breakdown?.length ? (

              <div className="empty-document">

                <span>
                  No transactions for this period.
                </span>

              </div>

            ) : (

              data.breakdown.map((item) => (

                <div
                  className="list-row"
                  key={item.type}
                >

                  <div>

                    <strong>
                      {transactionLabel(item.type)}
                    </strong>

                    <span className="muted">

                      {item.count} transaction
                      {item.count === 1
                        ? ""
                        : "s"}

                    </span>

                  </div>


                  <strong>
                    {money(item.total)}
                  </strong>

                </div>

              ))

            )}

          </section>

        </>

      )}

    </main>
  );
}
