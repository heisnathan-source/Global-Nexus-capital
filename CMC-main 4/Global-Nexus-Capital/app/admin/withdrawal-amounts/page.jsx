"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const EMPTY = {
  amount: "",
  displayOrder: "0",
  active: true,
  ranks: []
};

function rankId(rank) {
  if (rank && typeof rank === "object") {
    return rank.id;
  }

  return rank;
}

function rankName(rank) {
  if (rank && typeof rank === "object") {
    return rank.name || "";
  }

  return String(rank || "");
}

export default function WithdrawalAmountsAdmin() {
  const [data, setData] = useState({
    amounts: [],
    ranks: []
  });

  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/withdrawal-amounts",
        {
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to load withdrawal amounts."
        );
      }

      setData({
        amounts: Array.isArray(data.amounts)
          ? data.amounts
          : [],
        ranks: Array.isArray(data.ranks)
          ? data.ranks
          : []
      });
    } catch (error) {
      console.error(
        "Withdrawal amounts load error:",
        error
      );

      setError(
        error.message ||
        "Unable to load withdrawal amounts."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleRank(rank) {
    const name = rankName(rank);

    if (!name) return;

    setForm(current => {
      const exists = current.ranks.includes(name);

      return {
        ...current,
        ranks: exists
          ? current.ranks.filter(
              item => item !== name
            )
          : [...current.ranks, name]
      };
    });
  }

  async function save(event) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const amount = Number(form.amount);
      const displayOrder = Number(
        form.displayOrder || 0
      );

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(
          "Withdrawal amount must be greater than 0."
        );
      }

      const payload = {
        amount,
        displayOrder,
        active: form.active,
        ranks: form.ranks
      };

      const response = await fetch(
        "/api/admin/withdrawal-amounts",
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(
            editing
              ? {
                  ...payload,
                  id: editing
                }
              : payload
          )
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to save withdrawal amount."
        );
      }

      setMessage(
        editing
          ? "Withdrawal amount updated successfully."
          : "Withdrawal amount created successfully."
      );

      setForm({
        ...EMPTY,
        ranks: []
      });

      setEditing(null);

      await load();
    } catch (error) {
      console.error(
        "Withdrawal amount save error:",
        error
      );

      setError(
        error.message ||
        "Unable to save withdrawal amount."
      );
    } finally {
      setBusy(false);
    }
  }

  function edit(item) {
    const selectedRanks = Array.isArray(
      item.ranks
    )
      ? item.ranks
          .filter(rank => rank && rank.active)
          .map(rank => rankName(rank))
          .filter(Boolean)
      : [];

    setEditing(item.id);

    setForm({
      amount: String(item.amount ?? ""),
      displayOrder: String(
        item.display_order ?? 0
      ),
      active: item.active !== false,
      ranks: selectedRanks
    });

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function remove(id) {
    if (!id) return;

    const confirmed = window.confirm(
      "Delete this withdrawal amount?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/withdrawal-amounts?id=${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to delete withdrawal amount."
        );
      }

      setMessage(
        "Withdrawal amount deleted successfully."
      );

      await load();
    } catch (error) {
      console.error(
        "Withdrawal amount delete error:",
        error
      );

      setError(
        error.message ||
        "Unable to delete withdrawal amount."
      );
    }
  }

  function cancelEditing() {
    setEditing(null);

    setForm({
      ...EMPTY,
      ranks: []
    });

    setError("");
    setMessage("");
  }

  return (
    <main className="mobile-shell scroll-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>Withdrawal Amounts</h1>

          <p className="muted">
            Control withdrawal choices globally
            or by rank.
          </p>
        </div>

        <Link
          className="icon-button"
          href="/admin/withdrawals"
        >
          ←
        </Link>
      </header>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>
            {editing
              ? "Edit Withdrawal Amount"
              : "Create Withdrawal Amount"}
          </strong>

          <span className="badge">
            Global / Rank
          </span>
        </div>

        <p className="muted">
          Leave every rank unselected to make
          the amount available globally. Select
          one or more ranks to restrict the
          amount to those ranks.
        </p>

        <form
          className="form-card"
          onSubmit={save}
        >
          <label>
            Withdrawal Amount (GHS)

            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Enter amount"
              value={form.amount}
              onChange={event =>
                setForm({
                  ...form,
                  amount: event.target.value
                })
              }
              required
            />
          </label>

          <label>
            Display Order

            <input
              type="number"
              min="0"
              value={form.displayOrder}
              onChange={event =>
                setForm({
                  ...form,
                  displayOrder:
                    event.target.value
                })
              }
            />
          </label>

          <label>
            Availability

            <select
              value={
                form.active
                  ? "active"
                  : "inactive"
              }
              onChange={event =>
                setForm({
                  ...form,
                  active:
                    event.target.value ===
                    "active"
                })
              }
            >
              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>
          </label>

          <div>
            <strong>
              Assign to ranks
            </strong>

            <p className="muted">
              No rank selected = Global amount.
            </p>

            {loading ? (
              <p className="muted">
                Loading ranks...
              </p>
            ) : error ? (
              <div>
                <p className="auth-error">
                  {error}
                </p>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={load}
                >
                  Retry
                </button>
              </div>
            ) : data.ranks.length === 0 ? (
              <p className="muted">
                No active ranks were returned
                from the server.
              </p>
            ) : (
              <div className="amount-grid">
                {data.ranks.map(rank => {
                  const id = rankId(rank);
                  const name = rankName(rank);

                  if (!id || !name) {
                    return null;
                  }

                  return (
                    <button
                      type="button"
                      key={id}
                      className={
                        form.ranks.includes(name)
                          ? "amount-choice selected"
                          : "amount-choice"
                      }
                      onClick={() =>
                        toggleRank(rank)
                      }
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && !loading && (
            <p className="auth-error">
              {error}
            </p>
          )}

          {message && (
            <p className="muted">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={
              busy ||
              loading ||
              data.ranks.length === 0
            }
          >
            {busy
              ? "Saving..."
              : editing
                ? "Save Changes"
                : "Create Amount"}
          </button>

          {editing && (
            <button
              type="button"
              className="secondary-button"
              onClick={cancelEditing}
            >
              Cancel Editing
            </button>
          )}
        </form>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>
            Configured Withdrawal Amounts
          </strong>

          <span className="badge">
            {data.amounts.length} total
          </span>
        </div>

        {!data.amounts.length ? (
          <p className="muted">
            No withdrawal amounts have been
            created yet.
          </p>
        ) : (
          <div>
            {data.amounts.map(item => {
              const ranks = Array.isArray(
                item.ranks
              )
                ? item.ranks
                    .filter(
                      rank =>
                        rank &&
                        rank.active
                    )
                    .map(rank =>
                      rankName(rank)
                    )
                    .filter(Boolean)
                : [];

              return (
                <div
                  key={item.id}
                  className="service-row"
                  style={{
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap"
                  }}
                >
                  <div
                    style={{
                      flex: 1
                    }}
                  >
                    <strong>
                      GHS{" "}
                      {Number(
                        item.amount
                      ).toLocaleString()}
                    </strong>

                    <div className="muted">
                      Order:{" "}
                      {item.display_order}{" "}
                      ·{" "}
                      {item.active
                        ? "Active"
                        : "Inactive"}
                    </div>

                    <div className="muted">
                      {ranks.length
                        ? `Ranks: ${ranks.join(
                            ", "
                          )}`
                        : "Global — all ranks"}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      edit(item)
                    }
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      remove(item.id)
                    }
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="admin-card">
        <strong>
          How rank selection works
        </strong>

        <p className="muted">
          Global amounts are available to all
          users. Rank-specific amounts appear
          for users belonging to the selected
          rank. A user can receive both their
          rank-specific amounts and global
          amounts.
        </p>

        <Link
          className="text-link"
          href="/admin/withdrawals"
        >
          ← Back to Withdrawal Management
        </Link>
      </section>
    </main>
  );
}
