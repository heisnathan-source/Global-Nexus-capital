"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const EMPTY_FORM = {
  name: "",
  requiredDirectMembers: "",
  requiredQualifyingMembers: "",
  salaryAmount: "",
  paymentIntervalMonths: "2",
  cashBonus: "",
  displayOrder: "1",
  active: true,
};

export default function PositionsAdmin() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [rows, setRows] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const response = await fetch(
        "/api/admin/management-positions",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Unable to load management positions."
        );
        return;
      }

      setRows(data.positions || []);
    } catch {
      setError("Unable to load management positions.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function editPosition(position) {
    setEditingId(position.id);

    setForm({
      name: position.name || "",
      requiredDirectMembers: String(
        position.required_direct_members ?? 0
      ),
      requiredQualifyingMembers: String(
        position.required_qualifying_members ?? 0
      ),
      salaryAmount: String(position.salary_amount ?? 0),
      paymentIntervalMonths: String(
        position.payment_interval_months ?? 2
      ),
      cashBonus: String(position.cash_bonus ?? 0),
      displayOrder: String(position.display_order ?? 0),
      active: position.active !== false,
    });

    setMsg("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function save() {
    setMsg("");
    setError("");

    if (!form.name.trim()) {
      setError("Position name is required.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        "/api/admin/management-positions",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(editingId ? { id: editingId } : {}),
            ...form,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            (editingId
              ? "Unable to update position."
              : "Unable to create position.")
        );
        return;
      }

      setMsg(
        editingId
          ? "Position updated successfully."
          : "Position created successfully."
      );

      resetForm();
      await load();
    } catch {
      setError(
        editingId
          ? "Unable to update position."
          : "Unable to create position."
      );
    } finally {
      setBusy(false);
    }
  }

  async function deletePosition(position) {
    if (position.has_contract_history) {
      setError(
        "This position has management contract history and cannot be deleted. Deactivate it instead."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${position.name}" permanently? This cannot be undone.`
    );

    if (!confirmed) return;

    setMsg("");
    setError("");
    setBusy(true);

    try {
      const response = await fetch(
        "/api/admin/management-positions",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: position.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Unable to delete position."
        );
        return;
      }

      if (editingId === position.id) {
        resetForm();
      }

      setMsg("Position deleted successfully.");
      await load();
    } catch {
      setError("Unable to delete position.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mobile-shell scroll-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">GLOBAL NEXUS CAPITAL ADMIN</div>
          <h1>Management Positions</h1>
          <p className="muted">
            Configure team requirements and management salary payments.
          </p>
        </div>

        <Link className="icon-button" href="/admin">
          ←
        </Link>
      </header>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>
            {editingId ? "Edit Position" : "Create Position"}
          </strong>

          {editingId && (
            <button
              type="button"
              className="small-button"
              onClick={resetForm}
              disabled={busy}
            >
              Cancel
            </button>
          )}
        </div>

        <div className="form-card">
          <label>
            Position name
            <input
              value={form.name}
              onChange={(event) =>
                updateField("name", event.target.value)
              }
              placeholder="Assistant"
            />
          </label>

          <div className="setting-grid">
            <label>
              Required direct members
              <input
                inputMode="numeric"
                min="0"
                value={form.requiredDirectMembers}
                onChange={(event) =>
                  updateField(
                    "requiredDirectMembers",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Required qualifying members
              <input
                inputMode="numeric"
                min="0"
                value={form.requiredQualifyingMembers}
                onChange={(event) =>
                  updateField(
                    "requiredQualifyingMembers",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Salary per payment
              <input
                inputMode="decimal"
                type="number"
                min="0"
                step="0.01"
                value={form.salaryAmount}
                onChange={(event) =>
                  updateField(
                    "salaryAmount",
                    event.target.value
                  )
                }
                placeholder="0.00"
              />
            </label>

            <label>
              Payment interval (months)
              <input
                inputMode="numeric"
                type="number"
                min="1"
                step="1"
                value={form.paymentIntervalMonths}
                onChange={(event) =>
                  updateField(
                    "paymentIntervalMonths",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Cash bonus
              <input
                inputMode="decimal"
                type="number"
                min="0"
                step="0.01"
                value={form.cashBonus}
                onChange={(event) =>
                  updateField(
                    "cashBonus",
                    event.target.value
                  )
                }
                placeholder="0.00"
              />
            </label>

            <label>
              Display order
              <input
                inputMode="numeric"
                type="number"
                min="0"
                step="1"
                value={form.displayOrder}
                onChange={(event) =>
                  updateField(
                    "displayOrder",
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <label className="setting-row">
            <span>Position is active</span>

            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                updateField("active", event.target.checked)
              }
            />
          </label>

          <button
            className="primary-button"
            type="button"
            onClick={save}
            disabled={busy}
          >
            {busy
              ? "Saving…"
              : editingId
                ? "Update Position"
                : "Save Position"}
          </button>

          {msg && (
            <p className="auth-success">
              {msg}
            </p>
          )}

          {error && (
            <p className="auth-error">
              {error}
            </p>
          )}
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>Saved Positions</strong>
          <span className="badge">
            {rows.length}
          </span>
        </div>

        {rows.length ? (
          rows.map((position) => (
            <div
              className="list-row"
              key={position.id}
            >
              <div>
                <strong>{position.name}</strong>

                <span className="muted">
                  {position.required_direct_members} direct ·{" "}
                  {position.required_qualifying_members} qualifying
                  {" · "}
                  GHS{" "}
                  {Number(
                    position.salary_amount || 0
                  ).toLocaleString()}{" "}
                  /{" "}
                  {position.payment_interval_months} month
                  {position.payment_interval_months === 1
                    ? ""
                    : "s"}
                </span>

                <span className="muted">
                  Cash bonus: GHS{" "}
                  {Number(
                    position.cash_bonus || 0
                  ).toLocaleString()}
                </span>

                {position.has_contract_history && (
                  <span className="muted">
                    Salary history exists — deletion locked
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <span
                  className={
                    position.active
                      ? "status-on"
                      : "status-off"
                  }
                >
                  {position.active
                    ? "Active"
                    : "Inactive"}
                </span>

                <button
                  type="button"
                  className="small-button"
                  onClick={() =>
                    editPosition(position)
                  }
                  disabled={busy}
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="small-button"
                  onClick={() =>
                    deletePosition(position)
                  }
                  disabled={
                    busy ||
                    position.has_contract_history
                  }
                  title={
                    position.has_contract_history
                      ? "Cannot delete a position with contract history."
                      : "Delete position"
                  }
                  style={{
                    opacity:
                      position.has_contract_history
                        ? 0.5
                        : 1,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">
            No management positions have been saved yet.
          </p>
        )}
      </section>

      <section className="admin-card">
        <strong>Salary rules</strong>

        <p className="muted">
          Management salary is checked on the server before
          payment. The first two payments require the position
          qualification. From the third payment onward, the
          qualifying direct team must continue growing.
        </p>

        <p className="muted">
          A position with existing management contract history
          cannot be permanently deleted. Deactivate it instead
          to stop it from being newly assigned.
        </p>

        <p className="muted">
          Changing a position&apos;s salary or payment interval
          changes the configuration used by its active
          management contracts.
        </p>
      </section>
    </main>
  );
}
