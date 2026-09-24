"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function Deposits() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const r = await fetch(
        "/api/admin/deposits",
        {
          cache: "no-store"
        }
      );

      const d = await r.json();

      if (r.ok) {
        setRows(d.orders || []);
        setError("");
      } else {
        setError(
          d.error ||
            "Unable to load deposits."
        );
      }
    } catch (e) {
      setError(
        e?.message ||
          "Unable to load deposits."
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((o) => {

      const searchableValues = [
        o.id,
        o.user_id,
        o.user_name,
        o.registered_phone,
        o.payment_phone,
        o.account_number,
        o.payment_number,
        o.recipient_name,
        o.payment_network,
        o.amount,
        `DEP-${o.id}`
      ];

      return searchableValues.some(
        (value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
      );
    });

  }, [rows, search]);

  async function act(orderId, action) {
    if (busyId) return;

    const reason =
      action === "reject"
        ? window.prompt(
            "Reason for rejection:"
          ) ||
          "Payment not verified"
        : "";

    setBusyId(orderId);
    setError("");

    try {
      const r = await fetch(
        "/api/admin/deposits",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json"
          },
          body: JSON.stringify({
            orderId,
            action,
            reason
          })
        }
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.error ||
            "Action failed."
        );
      }

      await load();

    } catch (e) {

      setError(
        e?.message ||
          "Action failed."
      );

    } finally {

      setBusyId("");

    }
  }

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>

          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Deposit Verification
          </h1>

          <p className="muted">
            Review and approve customer payments
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

        <label>

          Search Deposit

          <input
            type="text"
            placeholder="Search phone, amount, Order ID or transaction ID..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

        </label>

        <p className="muted">

          Search by phone number, amount,
          Order ID, transaction reference,
          user name or payment number.

        </p>

      </section>


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Pending Deposits
          </strong>

          <span className="badge">
            {filteredRows.length}
          </span>

        </div>


        {error && (

          <p className="auth-error">
            {error}
          </p>

        )}


        {filteredRows.length === 0 ? (

          <div className="empty-document">

            <span>
              {search
                ? "No deposits found for this search."
                : "No payment submissions waiting for verification"}
            </span>

          </div>

        ) : (

          filteredRows.map((o) => (

            <div
              key={o.id}
              className="admin-card"
            >

              <div className="admin-card-head">

                <strong>
                  {o.user_name ||
                    o.user_id}
                </strong>

                <span className="badge">
                  {o.status}
                </span>

              </div>


              <div className="payment-details">

                <div>

                  <span>
                    Deposit Amount
                  </span>

                  <strong>

                    GHS{" "}

                    {Number(
                      o.amount
                    ).toLocaleString(
                      "en-GH",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }
                    )}

                  </strong>

                </div>


                <div>

                  <span>
                    User Payment Number
                  </span>

                  <strong>
                    {o.payment_phone ||
                      "—"}
                  </strong>

                </div>


                <div>

                  <span>
                    Detected Payment Network
                  </span>

                  <strong>
                    {o.payment_network ||
                      "—"}
                  </strong>

                </div>


                <div>

                  <span>
                    Assigned Global Nexus Capital Payment Number
                  </span>

                  <strong>
                    {o.account_number ||
                      o.payment_number ||
                      "—"}
                  </strong>

                </div>


                <div>

                  <span>
                    Assigned Recipient
                  </span>

                  <strong>
                    {o.recipient_name ||
                      "—"}
                  </strong>

                </div>


                <div>

                  <span>
                    Registered Account Phone
                  </span>

                  <strong>
                    {o.registered_phone ||
                      "—"}
                  </strong>

                </div>


                <div>

                  <span>
                    Order ID
                  </span>

                  <strong>
                    {o.id}
                  </strong>

                </div>


                <div>

                  <span>
                    Transaction Reference
                  </span>

                  <strong>
                    DEP-{o.id}
                  </strong>

                </div>

              </div>


              <p className="muted">

                Confirm that the money was actually
                received before approving this deposit.

              </p>


              <div className="admin-actions">

                <button
                  type="button"
                  disabled={
                    busyId === o.id
                  }
                  onClick={() =>
                    act(
                      o.id,
                      "reject"
                    )
                  }
                >

                  {busyId === o.id
                    ? "Processing..."
                    : "Reject"}

                </button>


                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    busyId === o.id
                  }
                  onClick={() =>
                    act(
                      o.id,
                      "verify"
                    )
                  }
                >

                  {busyId === o.id
                    ? "Processing..."
                    : "Verify & Credit"}

                </button>

              </div>

            </div>

          ))

        )}

      </section>


      <section className="admin-card">

        <strong>
          Audit trail
        </strong>

        <p className="muted">

          Every verification or rejection is recorded
          with the Admin account, time, target order
          and reason where provided.

        </p>

      </section>

    </main>
  );
}
