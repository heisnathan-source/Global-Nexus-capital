"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TeamView from "@/app/components/TeamView";

function money(value) {
  return Number(value || 0).toLocaleString(
    "en-GH",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );
}

function formatDate(value) {
  if (!value) {
    return "Not scheduled";
  }

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "Not scheduled";
  }

  return d.toLocaleDateString(
    "en-GH",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}

export default function TeamExpansion() {
  const [status, setStatus] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadManagement() {
    try {
      setError("");

      const response = await fetch(
        "/api/management/status",
        {
          credentials: "include",
          cache: "no-store"
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load management information."
        );
      }

      setStatus(data);
    } catch (err) {
      console.error(
        "Management status load failed:",
        err
      );

      setError(
        err.message ||
          "Unable to load management information."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadManagement();
  }, []);

  const contract =
    status?.contract || null;

  const team =
    status?.team || {
      directMembers: 0,
      qualifyingMembers: 0
    };

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">
        <div>
          <div className="eyebrow">
            Global Nexus Capital
          </div>

          <h1>
            Team Management
          </h1>

          <p className="muted">
            Your team, management position
            and salary
          </p>
        </div>

        <Link
          className="icon-button"
          href="/mine"
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


      <section className="mine-stat-grid">

        <div>
          <span>
            Direct Members
          </span>

          <strong>
            {team.directMembers}
          </strong>
        </div>

        <div>
          <span>
            Qualified Members
          </span>

          <strong>
            {team.qualifyingMembers}
          </strong>
        </div>

      </section>


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Management Position
          </strong>

          {contract ? (
            <span className="badge">
              Active
            </span>
          ) : (
            <span className="badge">
              Not active
            </span>
          )}

        </div>


        {loading ? (

          <p className="muted">
            Checking your management
            qualification...
          </p>

        ) : contract ? (

          <>

            <h2>
              {contract.position_name}
            </h2>


            <div className="mine-stat-grid">

              <div>
                <span>
                  Salary / Payment
                </span>

                <strong>
                  GHS{" "}
                  {money(
                    contract.salary_amount
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Payments Received
                </span>

                <strong>
                  {contract.payments_received}
                </strong>
              </div>


              <div>
                <span>
                  Next Payment
                </span>

                <strong>
                  {formatDate(
                    contract.next_payment_at
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Total Earned
                </span>

                <strong>
                  GHS{" "}
                  {money(
                    status?.totalEarned
                  )}
                </strong>
              </div>

            </div>


            <p className="muted">
              Payment interval: every{" "}
              {contract.payment_interval_months}{" "}
              month
              {contract.payment_interval_months === 1
                ? ""
                : "s"}.
            </p>


            {contract.payments_received >= 2 && (

              <div className="form-card">

                <strong>
                  Continuing qualification
                </strong>

                <p className="muted">
                  Your qualifying direct team
                  is checked again before future
                  salary payments.
                </p>


                <div className="mine-stat-grid">

                  <div>
                    <span>
                      Last recorded
                    </span>

                    <strong>
                      {contract.last_member_count}
                    </strong>
                  </div>


                  <div>
                    <span>
                      Current qualified
                    </span>

                    <strong>
                      {team.qualifyingMembers}
                    </strong>
                  </div>

                </div>

              </div>

            )}

          </>

        ) : (

          <>

            <strong>
              No active management contract
            </strong>

            <p className="muted">
              Your management contract will
              appear here automatically when
              you qualify for an active
              management position.
            </p>

          </>

        )}

      </section>


      {contract && (

        <section className="admin-card">

          <div className="admin-card-head">

            <strong>
              Salary History
            </strong>

            <span className="badge">
              {status?.paymentHistory?.length || 0}
            </span>

          </div>


          {status?.paymentHistory?.length ? (

            status.paymentHistory.map(
              (payment) => (

                <div
                  className="list-row"
                  key={payment.id}
                >

                  <div>

                    <strong>
                      Payment #
                      {payment.cycle_number}
                    </strong>

                    <span className="muted">
                      {formatDate(
                        payment.paid_at ||
                          payment.scheduled_at
                      )}
                    </span>

                  </div>


                  <span className="badge">

                    {payment.status === "paid"
                      ? `GHS ${money(
                          payment.amount
                        )}`
                      : payment.status}

                  </span>

                </div>

              )
            )

          ) : (

            <div className="empty-document">
              <span>
                No salary payments yet.
              </span>
            </div>

          )}

        </section>

      )}


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Who Qualifies Me
          </strong>

          <span className="badge">
            {team.qualifyingMembers}
          </span>

        </div>

        <p className="muted">
          Your directly linked members who
          have completed the Starter
          qualification.
        </p>

      </section>


      <TeamView />

    </main>
  );
}
