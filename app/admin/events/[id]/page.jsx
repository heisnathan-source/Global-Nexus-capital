"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const emptyPrize = {
  requiredMembers: "",
  prizeName: "",
  prizeType: "points",
  prizeValue: "",
  active: true,
};

export default function ManageEventPage() {
  const params = useParams();
  const eventId = params?.id;

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [prizeForm, setPrizeForm] = useState(emptyPrize);
  const [editingPrizeId, setEditingPrizeId] = useState(null);

  async function loadEvent() {
    if (!eventId) return;

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/admin/events", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Could not load event.");
      }

      const events = Array.isArray(data)
        ? data
        : data.events || [];

      const found = events.find((item) => item.id === eventId);

      if (!found) {
        throw new Error("Event not found.");
      }

      setEvent(found);

    } catch (error) {
      console.error(error);
      setMessage(error.message || "Could not load event.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  function updatePrize(key, value) {
    setPrizeForm((old) => ({
      ...old,
      [key]: value,
    }));
  }

  function resetPrizeForm() {
    setPrizeForm(emptyPrize);
    setEditingPrizeId(null);
  }

  async function savePrize(e) {
    e.preventDefault();

    if (!prizeForm.requiredMembers) {
      setMessage("Please enter the required number of members.");
      return;
    }

    if (!prizeForm.prizeName.trim()) {
      setMessage("Please enter a prize name.");
      return;
    }

    if (
      prizeForm.prizeType !== "item" &&
      (
        prizeForm.prizeValue === "" ||
        Number(prizeForm.prizeValue) < 0 ||
        (
          prizeForm.prizeType === "lucky_draw" &&
          (
            !Number.isInteger(Number(prizeForm.prizeValue)) ||
            Number(prizeForm.prizeValue) < 1
          )
        )
      )
    ) {
      setMessage(
        prizeForm.prizeType === "lucky_draw"
          ? "Please enter at least 1 Lucky Card draw."
          : "Please enter a valid prize value."
      );
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const body = {
        eventId,
        requiredMembers: Number(prizeForm.requiredMembers),
        prizeName: prizeForm.prizeName.trim(),
        prizeType: prizeForm.prizeType,
        prizeValue:
          prizeForm.prizeType === "item"
            ? 0
            : Number(prizeForm.prizeValue),
        active: prizeForm.active,
      };

      if (editingPrizeId) {
        body.id = editingPrizeId;
      }

      const res = await fetch("/api/admin/events/prizes", {
        method: editingPrizeId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || "Could not save prize."
        );
      }

      setMessage(
        editingPrizeId
          ? "Prize updated successfully."
          : "Prize added successfully."
      );

      resetPrizeForm();
      await loadEvent();

    } catch (error) {
      console.error(error);
      setMessage(
        error.message || "Could not save prize."
      );
    } finally {
      setSaving(false);
    }
  }

  function editPrize(prize) {
    setEditingPrizeId(prize.id);

    setPrizeForm({
      requiredMembers: prize.requiredMembers ?? "",
      prizeName: prize.prizeName ?? "",
      prizeType: prize.prizeType ?? "points",
      prizeValue:
        prize.prizeType === "item"
          ? ""
          : prize.prizeValue ?? "",
      active: prize.active !== false,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function removePrize(prizeId) {
    const confirmed = window.confirm(
      "Are you sure you want to remove this prize?"
    );

    if (!confirmed) return;

    try {
      setMessage("");

      const res = await fetch(
        "/api/admin/events/prizes",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: prizeId,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || "Could not remove prize."
        );
      }

      setMessage("Prize removed successfully.");

      if (editingPrizeId === prizeId) {
        resetPrizeForm();
      }

      await loadEvent();

    } catch (error) {
      console.error(error);
      setMessage(
        error.message || "Could not remove prize."
      );
    }
  }

  if (loading) {
    return (
      <main className="manage-event-page">
        <div className="manage-container">
          <div className="loading-card">
            Loading event...
          </div>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="manage-event-page">
        <div className="manage-container">
          <div className="loading-card error-card">
            {message || "Event not found."}
          </div>

          <Link href="/admin/events" className="back-button">
            ← Back to Events
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="manage-event-page">
      <div className="manage-container">

        <header className="page-header">
          <div>
            <div className="admin-label">GLOBAL NEXUS CAPITAL ADMIN</div>
            <h1>Manage Event</h1>
            <p>
              Configure this event and its member reward requirements.
            </p>
          </div>

          <Link href="/admin/events" className="back-button">
            ← Events
          </Link>
        </header>

        {message && (
          <div className="message-box">
            {message}
          </div>
        )}

        <section className="event-summary-card">

          <div className="event-banner">
            {event.banner_url ? (
              <img
                src={event.banner_url}
                alt={event.name}
              />
            ) : (
              <div className="banner-placeholder">
                Global Nexus Capital EVENT
              </div>
            )}
          </div>

          <div className="event-summary-content">
            <div className="event-status-row">
              <span
                className={`status ${event.status || "draft"}`}
              >
                {event.status || "draft"}
              </span>
            </div>

            <h2>{event.name}</h2>

            <p>
              {event.description ||
                "No description has been added for this event."}
            </p>

            <div className="dates">
              {event.start_at && (
                <div>
                  <span>STARTS</span>
                  <strong>
                    {new Date(event.start_at).toLocaleString()}
                  </strong>
                </div>
              )}

              {event.end_at && (
                <div>
                  <span>ENDS</span>
                  <strong>
                    {new Date(event.end_at).toLocaleString()}
                  </strong>
                </div>
              )}
            </div>
          </div>

        </section>

        <section className="admin-card prize-form-card">

          <div className="section-heading">
            <div>
              <h2>
                {editingPrizeId
                  ? "Edit Prize"
                  : "Add Prize"}
              </h2>

              <p>
                Add rewards users can unlock by reaching
                the required number of qualifying members.
              </p>
            </div>
          </div>

          <form onSubmit={savePrize}>

            <div className="form-grid">

              <div className="field">
                <label>Required Members</label>

                <input
                  type="number"
                  min="1"
                  placeholder="Example: 5"
                  value={prizeForm.requiredMembers}
                  onChange={(e) =>
                    updatePrize(
                      "requiredMembers",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="field">
                <label>Prize Name</label>

                <input
                  type="text"
                  placeholder="Example: Welcome Points"
                  value={prizeForm.prizeName}
                  onChange={(e) =>
                    updatePrize(
                      "prizeName",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="field">
                <label>Prize Type</label>

                <select
                  value={prizeForm.prizeType}
                  onChange={(e) =>
                    updatePrize(
                      "prizeType",
                      e.target.value
                    )
                  }
                >
                  <option value="points">Points</option>
                  <option value="cash">Cash</option>
                  <option value="lucky_draw">Lucky Card Draws</option>
                  <option value="item">Item / Special Prize</option>
                </select>
              </div>

              <div className="field">
                <label>
                  {prizeForm.prizeType === "lucky_draw"
                    ? "Number of Lucky Card Draws"
                    : "Prize Value"}
                  {prizeForm.prizeType === "item"
                    ? " (not required)"
                    : ""}
                </label>

                <input
                  type="number"
                  min="0"
                  step={
                    prizeForm.prizeType === "lucky_draw"
                      ? "1"
                      : "0.01"
                  }
                  disabled={prizeForm.prizeType === "item"}
                  placeholder={
                    prizeForm.prizeType === "item"
                      ? "Not required for item prizes"
                      : prizeForm.prizeType === "lucky_draw"
                        ? "Example: 3"
                        : "Enter prize value"
                  }
                  value={prizeForm.prizeValue}
                  onChange={(e) =>
                    updatePrize(
                      "prizeValue",
                      e.target.value
                    )
                  }
                />
              </div>

            </div>

            <div className="prize-controls">

              <label className="active-toggle">
                <input
                  type="checkbox"
                  checked={prizeForm.active}
                  onChange={(e) =>
                    updatePrize(
                      "active",
                      e.target.checked
                    )
                  }
                />

                <span>Prize is active</span>
              </label>

              <div className="form-actions">

                {editingPrizeId && (
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={resetPrizeForm}
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  className="save-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingPrizeId
                      ? "Update Prize"
                      : "Add Prize"}
                </button>

              </div>

            </div>

          </form>

        </section>

        <section className="prizes-section">

          <div className="section-heading">
            <div>
              <h2>Event Prize Requirements</h2>

              <p>
                Rewards currently configured for this event.
              </p>
            </div>
          </div>

          {!event.prizes || event.prizes.length === 0 ? (

            <div className="empty-state">
              <div className="empty-icon">🏆</div>

              <h3>No prizes added yet</h3>

              <p>
                Add the first reward using the form above.
              </p>
            </div>

          ) : (

            <div className="table-wrap">

              <table>

                <thead>
                  <tr>
                    <th>Required Members</th>
                    <th>Prize</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>

                  {event.prizes.map((prize) => (

                    <tr key={prize.id}>

                      <td>{prize.requiredMembers}</td>

                      <td>
                        <strong>{prize.prizeName}</strong>
                      </td>

                      <td className="capitalize">
                        {prize.prizeType}
                      </td>

                      <td>
                        {prize.prizeType === "item"
                          ? "—"
                          : prize.prizeType === "lucky_draw"
                            ? `${prize.prizeValue} draw(s)`
                            : prize.prizeValue}
                      </td>

                      <td>
                        <span
                          className={
                            prize.active
                              ? "prize-status active"
                              : "prize-status inactive"
                          }
                        >
                          {prize.active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <div className="action-buttons">

                          <button
                            className="edit-button"
                            onClick={() =>
                              editPrize(prize)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="delete-button"
                            onClick={() =>
                              removePrize(prize.id)
                            }
                          >
                            Remove
                          </button>

                        </div>
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </section>

      </div>

      <style jsx>{`

        .manage-event-page {
          min-height: 100vh;
          background: #f4f7fb;
          padding: 28px 16px 70px;
          color: #172033;
        }

        .manage-container {
          width: 100%;
          max-width: 980px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .admin-label {
          color: #2563eb;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 3px;
          margin-bottom: 7px;
        }

        .page-header h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 800;
        }

        .page-header p {
          margin: 8px 0 0;
          color: #64748b;
        }

        .back-button {
          text-decoration: none;
          background: white;
          border: 1px solid #dbe3ef;
          color: #172033;
          padding: 11px 15px;
          border-radius: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .message-box {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          padding: 14px 16px;
          border-radius: 14px;
          margin-bottom: 20px;
          font-weight: 600;
        }

        .event-summary-card,
        .admin-card,
        .prizes-section,
        .loading-card {
          background: white;
          border: 1px solid #e3e9f2;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(15,23,42,.05);
        }

        .event-summary-card {
          display: grid;
          grid-template-columns: 280px 1fr;
          overflow: hidden;
          margin-bottom: 22px;
        }

        .event-banner {
          min-height: 230px;
          background: #edf2f7;
        }

        .event-banner img {
          width: 100%;
          height: 100%;
          min-height: 230px;
          object-fit: cover;
          display: block;
        }

        .banner-placeholder {
          height: 230px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #64748b;
        }

        .event-summary-content {
          padding: 28px;
        }

        .event-summary-content h2 {
          margin: 14px 0 10px;
          font-size: 27px;
        }

        .event-summary-content p {
          color: #64748b;
          line-height: 1.6;
          margin: 0;
        }

        .status {
          display: inline-block;
          padding: 6px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .status.active {
          background: #dcfce7;
          color: #15803d;
        }

        .status.draft {
          background: #fef3c7;
          color: #a16207;
        }

        .status.locked {
          background: #e0e7ff;
          color: #4338ca;
        }

        .status.ended {
          background: #e5e7eb;
          color: #4b5563;
        }

        .dates {
          display: flex;
          gap: 30px;
          margin-top: 22px;
        }

        .dates span {
          display: block;
          font-size: 10px;
          letter-spacing: 1px;
          color: #94a3b8;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .dates strong {
          font-size: 13px;
        }

        .admin-card,
        .prizes-section {
          padding: 26px;
          margin-bottom: 22px;
        }

        .section-heading h2 {
          margin: 0;
          font-size: 23px;
        }

        .section-heading p {
          color: #64748b;
          margin: 7px 0 22px;
          line-height: 1.5;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 800;
        }

        .field input,
        .field select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9e1ec;
          border-radius: 12px;
          padding: 13px 14px;
          font-size: 14px;
          outline: none;
          background: white;
        }

        .field input:focus,
        .field select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,.1);
        }

        .field input:disabled {
          background: #f1f5f9;
          color: #94a3b8;
        }

        .prize-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-top: 22px;
        }

        .active-toggle {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 14px;
          font-weight: 700;
        }

        .form-actions,
        .action-buttons {
          display: flex;
          gap: 10px;
        }

        button {
          cursor: pointer;
        }

        .save-button,
        .edit-button,
        .delete-button,
        .cancel-button {
          border: none;
          border-radius: 11px;
          padding: 11px 16px;
          font-weight: 800;
        }

        .save-button {
          background: #2563eb;
          color: white;
        }

        .save-button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .cancel-button {
          background: #eef2f7;
          color: #475569;
        }

        .edit-button {
          background: #eff6ff;
          color: #2563eb;
        }

        .delete-button {
          background: #fef2f2;
          color: #dc2626;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
        }

        th,
        td {
          padding: 15px 13px;
          border-bottom: 1px solid #edf1f5;
          text-align: left;
          font-size: 14px;
        }

        th {
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .5px;
        }

        .capitalize {
          text-transform: capitalize;
        }

        .prize-status {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .prize-status.active {
          background: #dcfce7;
          color: #15803d;
        }

        .prize-status.inactive {
          background: #fee2e2;
          color: #b91c1c;
        }

        .empty-state,
        .loading-card {
          text-align: center;
          padding: 50px 20px;
          color: #64748b;
        }

        .empty-icon {
          font-size: 35px;
          margin-bottom: 10px;
        }

        .empty-state h3 {
          color: #172033;
          margin: 5px 0;
        }

        .empty-state p {
          margin: 8px 0 0;
        }

        .error-card {
          color: #dc2626;
        }

        @media (max-width: 700px) {

          .page-header {
            align-items: flex-start;
          }

          .page-header h1 {
            font-size: 27px;
          }

          .event-summary-card {
            grid-template-columns: 1fr;
          }

          .event-banner,
          .event-banner img {
            min-height: 190px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .prize-controls {
            align-items: flex-start;
            flex-direction: column;
          }

          .form-actions {
            width: 100%;
          }

          .form-actions button {
            flex: 1;
          }

          .dates {
            flex-direction: column;
            gap: 14px;
          }

        }

      `}</style>
    </main>
  );
}
