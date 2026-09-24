"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");

  const [giftAmounts, setGiftAmounts] = useState({});
  const [giftNotes, setGiftNotes] = useState({});

  async function loadUsers(search = "") {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/users/search?q=" +
        encodeURIComponent(search)
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load users."
        );
      }

      setRows(data.users || []);

    } catch (err) {
      setError(
        err.message || "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers("");
  }, []);

  async function search(event) {
    event.preventDefault();
    loadUsers(q);
  }

  async function userAction(user, action) {
    setError("");
    setStatus("");

    let message = "";

    if (action === "suspend") {
      message =
        `Are you sure you want to suspend ${user.name}? ` +
        `They will no longer be able to use their Global Nexus Capital account.`;
    }

    if (action === "activate") {
      message =
        `Are you sure you want to restore ${user.name}'s account?`;
    }

    if (action === "remove") {
      message =
        `WARNING: Are you sure you want to remove ${user.name}? ` +
        `This will disable their account and withdrawals.`;
    }

    if (!window.confirm(message)) {
      return;
    }

    const workId = `${user.id}-${action}`;

    setWorking(workId);

    try {
      const response = await fetch(
        "/api/admin/users/action",
        {
          method: "POST",

          headers: {
            "content-type": "application/json"
          },

          body: JSON.stringify({
            userId: user.id,
            action
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to perform this action."
        );
      }

      setStatus(
        data.message || "Action completed successfully."
      );

      await loadUsers(q);

    } catch (err) {
      setError(
        err.message ||
        "Unable to perform this action."
      );
    } finally {
      setWorking("");
    }
  }

  async function giftCash(user) {
    setError("");
    setStatus("");

    const amount = Number(
      giftAmounts[user.id]
    );

    const note =
      String(
        giftNotes[user.id] || ""
      ).trim();

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Please enter a valid cash gift amount."
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to gift ${money(amount)} ` +
      `to ${user.name || "this user"}?`
    );

    if (!confirmed) {
      return;
    }

    const workId =
      `${user.id}-gift-cash`;

    setWorking(workId);

    try {

      const response = await fetch(
        "/api/admin/users/gift-cash",
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json"
          },

          body: JSON.stringify({
            userId: user.id,
            amount,
            note
          })
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to send cash gift."
        );
      }

      setStatus(
        `${money(amount)} was successfully gifted to ` +
        `${user.name || "the user"}.`
      );

      setGiftAmounts((current) => ({
        ...current,
        [user.id]: ""
      }));

      setGiftNotes((current) => ({
        ...current,
        [user.id]: ""
      }));

      await loadUsers(q);

    } catch (err) {

      setError(
        err.message ||
        "Unable to send cash gift."
      );

    } finally {

      setWorking("");

    }
  }


  function money(value) {
    return `GHS ${Number(
      value || 0
    ).toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function date(value) {
    if (!value) return "—";

    return new Date(value)
      .toLocaleDateString("en-GB");
  }

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>
          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>User Management</h1>

          <p className="muted">
            Search, suspend and manage Global Nexus Capital user accounts
          </p>
        </div>

        <Link
          className="icon-button"
          href="/admin"
        >
          ←
        </Link>

      </header>


      <form
        className="form-card"
        onSubmit={search}
      >

        <label>
          Search user
        </label>

        <input
          value={q}
          onChange={(e) =>
            setQ(e.target.value)
          }
          placeholder="User ID, name, or phone number"
        />

        <button
          className="primary-button"
          type="submit"
        >
          Search
        </button>

      </form>


      {status && (
        <section className="admin-card">
          <p className="auth-success">
            {status}
          </p>
        </section>
      )}


      {error && (
        <section className="admin-card">
          <p className="auth-error">
            {error}
          </p>
        </section>
      )}


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Users
          </strong>

          <span className="badge">
            {rows.length}
          </span>

        </div>


        {loading ? (

          <div className="empty-document">
            <span>
              Loading users...
            </span>
          </div>

        ) : !rows.length ? (

          <div className="empty-document">
            <span>
              No matching users.
            </span>
          </div>

        ) : (

          rows.map((user) => {

            const suspended =
              user.enabled === false;

            return (

              <article
                className="admin-card"
                key={user.id}
              >

                <div className="admin-card-head">

                  <div>

                    <strong>
                      {user.name || "Unnamed user"}
                    </strong>

                    <div className="muted">
                      {user.phone || "No phone number"}
                    </div>

                  </div>


                  <span className="badge">

                    {suspended
                      ? "SUSPENDED"
                      : "ACTIVE"}

                  </span>

                </div>


                <div className="mine-stat-grid">

                  <div>

                    <span>
                      Account Balance
                    </span>

                    <strong>
                      {money(
                        user.available_balance
                      )}
                    </strong>

                  </div>


                  <div>

                    <span>
                      Reserved Balance
                    </span>

                    <strong>
                      {money(
                        user.reserved_balance
                      )}
                    </strong>

                  </div>

                </div>


                <div className="list-row">

                  <div>

                    <strong>
                      Account ID
                    </strong>

                    <span className="muted">
                      {user.account_id || "—"}
                    </span>

                  </div>

                </div>


                <div className="list-row">

                  <div>

                    <strong>
                      Registration Date
                    </strong>

                    <span className="muted">
                      {date(
                        user.registration_date
                      )}
                    </span>

                  </div>

                </div>


                <div className="list-row">

                  <div>

                    <strong>
                      Rank
                    </strong>

                    <span className="muted">
                      {user.rank_name ||
                        "STARTER"}
                    </span>

                  </div>

                </div>


                <div className="list-row">

                  <div>

                    <strong>
                      Identity Status
                    </strong>

                    <span className="muted">

                      {user.identity_status ||
                        "unverified"}

                    </span>

                  </div>

                </div>


                <div className="list-row">

                  <div>

                    <strong>
                      Withdrawal
                    </strong>

                    <span className="muted">

                      {user.withdrawal_enabled
                        ? "Enabled"
                        : "Disabled"}

                    </span>

                  </div>

                </div>


                {/* =====================
                    ADMIN CASH GIFT
                ====================== */}

                <div className="form-section">

                  <div className="section-heading">

                    <strong>
                      Gift Cash
                    </strong>

                    <span className="muted">
                      Add cash directly to this user&apos;s account
                    </span>

                  </div>


                  <label>
                    Cash Gift Amount
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      giftAmounts[user.id] || ""
                    }
                    onChange={(event) =>
                      setGiftAmounts((current) => ({
                        ...current,
                        [user.id]: event.target.value
                      }))
                    }
                    placeholder="Enter amount in GHS"
                  />


                  <label>
                    Gift Note (optional)
                  </label>

                  <input
                    value={
                      giftNotes[user.id] || ""
                    }
                    onChange={(event) =>
                      setGiftNotes((current) => ({
                        ...current,
                        [user.id]: event.target.value
                      }))
                    }
                    placeholder="Reason or message for this gift"
                  />


                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      working ===
                      `${user.id}-gift-cash`
                    }
                    onClick={() =>
                      giftCash(user)
                    }
                  >

                    {working ===
                    `${user.id}-gift-cash`
                      ? "Sending Cash..."
                      : "Gift Cash to User"}

                  </button>

                </div>


                {/* =====================
                    ACCOUNT CONTROLS
                ====================== */}

                <div className="form-section">

                  <div className="section-heading">

                    <strong>
                      Account Controls
                    </strong>

                    <span className="muted">

                      Status:{" "}

                      {suspended
                        ? "Suspended"
                        : "Active"}

                    </span>

                  </div>


                  <div className="setting-grid">

                    {!suspended ? (

                      <button
                        type="button"
                        className="secondary-button"
                        disabled={
                          working ===
                          `${user.id}-suspend`
                        }
                        onClick={() =>
                          userAction(
                            user,
                            "suspend"
                          )
                        }
                      >

                        {working ===
                        `${user.id}-suspend`
                          ? "Suspending..."
                          : "Suspend User"}

                      </button>

                    ) : (

                      <button
                        type="button"
                        className="primary-button"
                        disabled={
                          working ===
                          `${user.id}-activate`
                        }
                        onClick={() =>
                          userAction(
                            user,
                            "activate"
                          )
                        }
                      >

                        {working ===
                        `${user.id}-activate`
                          ? "Restoring..."
                          : "Restore User"}

                      </button>

                    )}


                    <button
                      type="button"
                      className="danger-button"
                      disabled={
                        working ===
                        `${user.id}-remove`
                      }
                      onClick={() =>
                        userAction(
                          user,
                          "remove"
                        )
                      }
                    >

                      {working ===
                      `${user.id}-remove`
                        ? "Removing..."
                        : "Remove User"}

                    </button>

                  </div>

                </div>

              </article>

            );

          })

        )}

      </section>


      <section className="admin-card">

        <strong>
          Security
        </strong>

        <p className="muted">

          Suspended users are prevented from
          accessing their Global Nexus Capital account.

          Removed users have their account access
          and withdrawals disabled.

          User passwords and Funds Passwords
          are never displayed to administrators.

        </p>

      </section>

    </main>
  );
}
