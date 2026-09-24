"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const emptyForm = {
  id: "",
  name: "",
  description: "",
  starts_at: "",
  ends_at: "",
  status: "draft",
  existingBannerUrl: "",
};

function formatDateTimeForInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset =
    date.getTimezoneOffset() * 60000;

  return new Date(
    date.getTime() - offset
  )
    .toISOString()
    .slice(0, 16);
}

function formatDate(value) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleString();
}

export default function AdminEventsPage() {
  const [events, setEvents] =
    useState([]);

  const [form, setForm] =
    useState(emptyForm);

  const [banner, setBanner] =
    useState(null);

  const [bannerPreview, setBannerPreview] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [pageLoading, setPageLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [editingEvent, setEditingEvent] =
    useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState(null);

  const [deleting, setDeleting] =
    useState(false);

  async function loadEvents() {
    try {
      setPageLoading(true);

      const res =
        await fetch(
          "/api/admin/events",
          {
            cache: "no-store",
            credentials: "include",
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
          "Could not load events."
        );
      }

      if (Array.isArray(data)) {
        setEvents(data);
      } else if (
        Array.isArray(data?.events)
      ) {
        setEvents(data.events);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
        "Could not load events."
      );
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (!banner) {
      return;
    }

    const previewUrl =
      URL.createObjectURL(banner);

    setBannerPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [banner]);

  function updateForm(key, value) {
    setForm((old) => ({
      ...old,
      [key]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);

    setBanner(null);

    setBannerPreview("");

    setEditingEvent(false);

    const fileInput =
      document.getElementById(
        "event-banner"
      );

    if (fileInput) {
      fileInput.value = "";
    }
  }

  function startEdit(event) {
    setMessage("");

    setEditingEvent(true);

    setBanner(null);

    setBannerPreview(
      event.banner_url || ""
    );

    setForm({
      id: event.id || "",

      name:
        event.name || "",

      description:
        event.description || "",

      starts_at:
        formatDateTimeForInput(
          event.start_at
        ),

      ends_at:
        formatDateTimeForInput(
          event.end_at
        ),

      status:
        event.status || "draft",

      existingBannerUrl:
        event.banner_url || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function uploadBanner() {
    if (!banner) {
      return "";
    }

    const formData =
      new FormData();

    formData.append(
      "file",
      banner
    );

    formData.append(
      "folder",
      "event-banners"
    );

    const response =
      await fetch(
        "/api/admin/media",
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "Could not upload event banner."
      );
    }

    if (!data?.url) {
      throw new Error(
        "Banner upload did not return an image URL."
      );
    }

    return data.url;
  }

  async function saveEvent(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      setMessage(
        "Please enter an event name."
      );

      return;
    }

    try {
      setLoading(true);

      setMessage("");

      let bannerUrl =
        form.existingBannerUrl || "";

      if (banner) {
        setMessage(
          "Uploading event banner..."
        );

        bannerUrl =
          await uploadBanner();
      }

      setMessage(
        editingEvent
          ? "Updating event..."
          : "Saving event..."
      );

      const body = {
        name:
          form.name.trim(),

        description:
          form.description.trim(),

        bannerUrl:
          bannerUrl || null,

        startAt:
          form.starts_at || null,

        endAt:
          form.ends_at || null,

        status:
          form.status,
      };

      if (editingEvent) {
        body.id =
          form.id;
      }

      const res =
        await fetch(
          "/api/admin/events",
          {
            method:
              editingEvent
                ? "PUT"
                : "POST",

            credentials: "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(body),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
          data?.message ||
          "Could not save event."
        );
      }

      setMessage(
        editingEvent
          ? "Event updated successfully."
          : bannerUrl
            ? "Event and banner saved successfully."
            : "Event saved successfully."
      );

      resetForm();

      await loadEvents();
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
        "Could not save event."
      );
    } finally {
      setLoading(false);
    }
  }

  function askToRemove(event) {
    setMessage("");

    setDeleteTarget(event);
  }

  function cancelRemove() {
    if (deleting) {
      return;
    }

    setDeleteTarget(null);
  }

  async function removeEvent() {
    if (!deleteTarget?.id) {
      return;
    }

    try {
      setDeleting(true);

      setMessage("");

      const res =
        await fetch(
          `/api/admin/events?id=${encodeURIComponent(
            deleteTarget.id
          )}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
          data?.message ||
          "Could not remove event."
        );
      }

      const deletedName =
        deleteTarget.name;

      setDeleteTarget(null);

      setMessage(
        `"${deletedName}" was removed successfully.`
      );

      await loadEvents();
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
        "Could not remove event."
      );

      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const displayedBanner =
    bannerPreview ||
    form.existingBannerUrl ||
    "";

  return (
    <main className="events-admin-page">

      <div className="events-container">

        <section className="events-header">

          <div>

            <div className="admin-label">
              GLOBAL NEXUS CAPITAL ADMIN
            </div>

            <h1>
              Events
            </h1>

            <p>
              Create, edit, manage and control
              all Global Nexus Capital member events.
            </p>

          </div>

          <div className="header-actions">

            <Link
              href="/admin"
              className="refresh-button back-button"
              title="Back to Admin Dashboard"
            >
              ←
            </Link>

            <button
              type="button"
              className="refresh-button"
              onClick={loadEvents}
              title="Refresh events"
            >
              ↻
            </button>

          </div>

        </section>

        {message && (

          <div className="message-box">
            {message}
          </div>

        )}

        <section className="admin-card create-card">

          <div className="card-heading">

            <div>

              <h2>
                {editingEvent
                  ? "Edit Event"
                  : "Create Event"}
              </h2>

              <p>
                {editingEvent
                  ? "Update this Global Nexus Capital event and its information."
                  : "Create a new event for Global Nexus Capital members."}
              </p>

            </div>

            {editingEvent && (

              <button
                type="button"
                className="cancel-edit-button"
                onClick={resetForm}
              >
                Cancel Edit
              </button>

            )}

          </div>

          <form
            onSubmit={saveEvent}
            className="event-form"
          >

            <div className="field full-field">

              <label>
                Event Name
              </label>

              <input
                type="text"
                placeholder="Enter event name"
                value={form.name}
                onChange={(e) =>
                  updateForm(
                    "name",
                    e.target.value
                  )
                }
              />

            </div>

            <div className="field full-field">

              <label>
                Description
              </label>

              <textarea
                placeholder="Write a description for this event..."
                value={form.description}
                onChange={(e) =>
                  updateForm(
                    "description",
                    e.target.value
                  )
                }
              />

            </div>

            <div className="form-grid">

              <div className="field">

                <label>
                  Start Date & Time
                </label>

                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) =>
                    updateForm(
                      "starts_at",
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="field">

                <label>
                  End Date & Time
                </label>

                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) =>
                    updateForm(
                      "ends_at",
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="field">

                <label>
                  Event Status
                </label>

                <select
                  value={form.status}
                  onChange={(e) =>
                    updateForm(
                      "status",
                      e.target.value
                    )
                  }
                >

                  <option value="draft">
                    Draft
                  </option>

                  <option value="locked">
                    Locked
                  </option>

                  <option value="active">
                    Active
                  </option>

                  <option value="ended">
                    Ended
                  </option>

                </select>

              </div>

              <div className="field">

                <label>
                  Event Banner
                </label>

                <input
                  id="event-banner"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setBanner(
                      e.target.files?.[0] ||
                      null
                    )
                  }
                />

              </div>

            </div>

            {displayedBanner && (

              <div className="banner-preview">

                <div className="banner-preview-label">

                  {banner
                    ? "New Banner Preview"
                    : "Current Event Banner"}

                </div>

                <img
                  src={displayedBanner}
                  alt="Event banner preview"
                />

                <p>

                  {banner
                    ? "This new image will replace the current banner when you save."
                    : "The current banner will remain attached unless you choose a new image."}

                </p>

              </div>

            )}

            <div className="form-actions">

              {editingEvent && (

                <button
                  type="button"
                  className="cancel-edit-button"
                  onClick={resetForm}
                  disabled={loading}
                >
                  Cancel
                </button>

              )}

              <button
                type="submit"
                className="save-button"
                disabled={loading}
              >

                {loading
                  ? editingEvent
                    ? "Updating..."
                    : "Saving..."
                  : editingEvent
                    ? "Update Event"
                    : "Create Event"}

              </button>

            </div>

          </form>

        </section>

        <section className="events-list-section">

          <div className="section-heading">

            <div>

              <h2>
                All Events
              </h2>

              <p>
                Edit event information, manage rewards
                or remove unused events.
              </p>

            </div>

            <div className="event-count">

              {events.length}{" "}

              {events.length === 1
                ? "Event"
                : "Events"}

            </div>

          </div>

          {pageLoading ? (

            <div className="loading-card">
              Loading events...
            </div>

          ) : events.length === 0 ? (

            <div className="empty-state">

              <div className="empty-icon">
                🎉
              </div>

              <h3>
                No events yet
              </h3>

              <p>
                Create your first Global Nexus Capital event using
                the form above.
              </p>

            </div>

          ) : (

            <div className="events-grid">

              {events.map((event) => (

                <article
                  key={event.id}
                  className="event-card"
                >

                  <div className="event-image">

                    {event.banner_url ? (

                      <img
                        src={event.banner_url}
                        alt={event.name}
                      />

                    ) : (

                      <div className="event-image-placeholder">
                        Global Nexus Capital EVENT
                      </div>

                    )}

                    <span
                      className={`status-badge ${
                        event.status || "draft"
                      }`}
                    >
                      {event.status || "draft"}
                    </span>

                  </div>

                  <div className="event-card-content">

                    <h3>
                      {event.name}
                    </h3>

                    <p className="event-description">

                      {event.description ||
                        "No description has been added for this event."}

                    </p>

                    <div className="event-dates">

                      <div>

                        <span>
                          START
                        </span>

                        <strong>
                          {formatDate(
                            event.start_at
                          )}
                        </strong>

                      </div>

                      <div>

                        <span>
                          END
                        </span>

                        <strong>
                          {formatDate(
                            event.end_at
                          )}
                        </strong>

                      </div>

                    </div>

                    <div className="reward-count">

                      🏆{" "}

                      {Array.isArray(event.prizes)
                        ? event.prizes.length
                        : 0}{" "}

                      {Array.isArray(event.prizes) &&
                      event.prizes.length === 1
                        ? "Reward"
                        : "Rewards"}

                    </div>

                  </div>

                  {/* CLEAN EVENT ACTION BUTTONS */}

                  <div className="event-actions">

                    <button
                      type="button"
                      className="event-action-button edit-button"
                      onClick={() =>
                        startEdit(event)
                      }
                    >

                      <span className="action-icon">
                        ✎
                      </span>

                      <span>
                        Edit
                      </span>

                    </button>

                    <Link
                      href={`/admin/events/${event.id}`}
                      className="event-action-button manage-button"
                    >

                      <span className="action-icon">
                        ⚙
                      </span>

                      <span>
                        Manage
                      </span>

                    </Link>

                    <button
                      type="button"
                      className="event-action-button remove-button"
                      onClick={() =>
                        askToRemove(event)
                      }
                    >

                      <span className="action-icon">
                        🗑
                      </span>

                      <span>
                        Remove
                      </span>

                    </button>

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

      </div>

      {deleteTarget && (

        <div
          className="delete-modal-overlay"
          onMouseDown={(e) => {

            if (
              e.target === e.currentTarget &&
              !deleting
            ) {
              cancelRemove();
            }

          }}
        >

          <div className="delete-modal">

            <div className="delete-icon">
              🗑
            </div>

            <h2>
              Remove Event?
            </h2>

            <p>
              You are about to permanently remove:
            </p>

            <strong className="delete-event-name">
              {deleteTarget.name}
            </strong>

            <div className="delete-warning">

              If this event has already created member
              reward records, it cannot be permanently
              deleted because Global Nexus Capital must preserve the
              reward history.

            </div>

            <div className="delete-actions">

              <button
                type="button"
                className="modal-cancel-button"
                onClick={cancelRemove}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="modal-delete-button"
                onClick={removeEvent}
                disabled={deleting}
              >

                {deleting
                  ? "Removing..."
                  : "Remove Event"}

              </button>

            </div>

          </div>

        </div>

      )}

      <style jsx>{`

        .events-admin-page {
          min-height: 100vh;
          background: #f4f7fb;
          padding: 28px 16px 80px;
          color: #172033;
        }

        .events-container {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
        }

        .events-header {
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

        .events-header h1 {
          margin: 0;
          font-size: 34px;
          font-weight: 800;
        }

        .events-header p {
          margin: 8px 0 0;
          color: #64748b;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .refresh-button {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: 1px solid #dbe3ef;
          background: white;
          color: #172033;
          font-size: 20px;
          cursor: pointer;
          display: grid;
          place-items: center;
          text-decoration: none;
          font-weight: 700;
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

        .admin-card,
        .events-list-section,
        .loading-card,
        .empty-state {
          background: white;
          border: 1px solid #e3e9f2;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
        }

        .create-card {
          padding: 24px;
          margin-bottom: 24px;
        }

        .card-heading,
        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 22px;
        }

        .card-heading h2,
        .section-heading h2 {
          margin: 0;
          font-size: 22px;
        }

        .card-heading p,
        .section-heading p {
          margin: 7px 0 0;
          color: #64748b;
          line-height: 1.5;
        }

        .event-form {
          display: grid;
          gap: 18px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .field {
          display: grid;
          gap: 8px;
        }

        .full-field {
          width: 100%;
        }

        .field label {
          font-size: 13px;
          font-weight: 800;
          color: #334155;
        }

        .field input,
        .field textarea,
        .field select {
          width: 100%;
          border: 1px solid #dbe3ef;
          border-radius: 12px;
          padding: 13px 14px;
          font-size: 14px;
          outline: none;
          background: white;
          box-sizing: border-box;
        }

        .field textarea {
          min-height: 110px;
          resize: vertical;
        }

        .field input:focus,
        .field textarea:focus,
        .field select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
        }

        .banner-preview {
          border: 1px solid #e3e9f2;
          border-radius: 16px;
          padding: 14px;
          background: #f8fafc;
        }

        .banner-preview-label {
          font-size: 12px;
          font-weight: 800;
          color: #2563eb;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .banner-preview img {
          width: 100%;
          max-height: 300px;
          object-fit: cover;
          border-radius: 12px;
          display: block;
        }

        .banner-preview p {
          margin: 10px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.5;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }

        .save-button {
          border: none;
          background: #2563eb;
          color: white;
          border-radius: 12px;
          padding: 13px 20px;
          font-weight: 800;
          cursor: pointer;
        }

        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .cancel-edit-button {
          border: 1px solid #dbe3ef;
          background: white;
          color: #475569;
          border-radius: 12px;
          padding: 11px 16px;
          font-weight: 700;
          cursor: pointer;
        }

        .events-list-section {
          padding: 24px;
        }

        .event-count {
          background: #eff6ff;
          color: #2563eb;
          padding: 9px 13px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .events-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 20px;
        }

        .event-card {
          border: 1px solid #e3e9f2;
          border-radius: 18px;
          overflow: hidden;
          background: white;
          display: flex;
          flex-direction: column;
          transition: transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .event-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 16px 35px
            rgba(15, 23, 42, 0.08);
        }

        .event-image {
          position: relative;
          width: 100%;
          height: 220px;
          background: #eaf1fb;
        }

        .event-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .event-image-placeholder {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: linear-gradient(
            135deg,
            #0f4c81,
            #2563eb
          );
          color: white;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .status-badge {
          position: absolute;
          top: 14px;
          right: 14px;
          padding: 7px 11px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          text-transform: capitalize;
          background: white;
          color: #475569;
        }

        .status-badge.active {
          background: #dcfce7;
          color: #15803d;
        }

        .status-badge.draft {
          background: #fef3c7;
          color: #b45309;
        }

        .status-badge.locked {
          background: #fee2e2;
          color: #b91c1c;
        }

        .status-badge.ended {
          background: #e2e8f0;
          color: #475569;
        }

        .event-card-content {
          padding: 20px;
          flex: 1;
        }

        .event-card-content h3 {
          margin: 0;
          font-size: 21px;
        }

        .event-description {
          color: #64748b;
          line-height: 1.55;
          margin: 10px 0 18px;
          min-height: 44px;
        }

        .event-dates {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 12px;
          border-top: 1px solid #edf1f5;
          padding-top: 15px;
        }

        .event-dates div {
          min-width: 0;
        }

        .event-dates span {
          display: block;
          font-size: 10px;
          color: #94a3b8;
          font-weight: 800;
          letter-spacing: 1px;
          margin-bottom: 5px;
        }

        .event-dates strong {
          display: block;
          font-size: 12px;
          color: #475569;
          line-height: 1.4;
          word-break: break-word;
        }

        .reward-count {
          margin-top: 17px;
          font-size: 13px;
          font-weight: 700;
          color: #475569;
        }

        /*
         * CLEAN EVENT ACTION AREA
         * Only the Edit / Manage / Remove interface
         * has been redesigned here.
         */

        .event-actions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          padding: 14px;
          border-top: 1px solid #edf1f5;
          background: #f8fafc;
        }

        .event-action-button {
          min-height: 48px;
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          text-decoration: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
          box-sizing: border-box;
        }

        .event-action-button:hover {
          transform: translateY(-1px);
        }

        .event-action-button:active {
          transform: translateY(0);
        }

        .action-icon {
          font-size: 16px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .edit-button {
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #2563eb;
        }

        .edit-button:hover {
          background: #dbeafe;
          box-shadow:
            0 5px 12px
            rgba(37, 99, 235, 0.12);
        }

        .manage-button {
          border: 1px solid #dbe3ef;
          background: white;
          color: #334155;
        }

        .manage-button:hover {
          background: #f1f5f9;
          box-shadow:
            0 5px 12px
            rgba(15, 23, 42, 0.08);
        }

        .remove-button {
          border: 1px solid #fecaca;
          background: #fff5f5;
          color: #dc2626;
        }

        .remove-button:hover {
          background: #fee2e2;
          box-shadow:
            0 5px 12px
            rgba(220, 38, 38, 0.1);
        }

        .loading-card,
        .empty-state {
          padding: 45px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 38px;
          margin-bottom: 12px;
        }

        .empty-state h3 {
          margin: 0;
        }

        .empty-state p {
          color: #64748b;
          margin-bottom: 0;
        }

        .delete-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .delete-modal {
          width: 100%;
          max-width: 440px;
          background: white;
          border-radius: 22px;
          padding: 28px;
          box-shadow:
            0 25px 70px
            rgba(0, 0, 0, 0.25);
          text-align: center;
        }

        .delete-icon {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: #fee2e2;
          display: grid;
          place-items: center;
          margin: 0 auto 16px;
          font-size: 25px;
        }

        .delete-modal h2 {
          margin: 0;
          font-size: 24px;
        }

        .delete-modal > p {
          color: #64748b;
          margin: 14px 0 8px;
        }

        .delete-event-name {
          display: block;
          font-size: 18px;
          color: #172033;
          margin-bottom: 18px;
          word-break: break-word;
        }

        .delete-warning {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          border-radius: 14px;
          padding: 13px;
          text-align: left;
          font-size: 13px;
          line-height: 1.55;
        }

        .delete-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 22px;
        }

        .modal-cancel-button,
        .modal-delete-button {
          border-radius: 12px;
          padding: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .modal-cancel-button {
          background: white;
          border: 1px solid #dbe3ef;
          color: #475569;
        }

        .modal-delete-button {
          background: #dc2626;
          border: 1px solid #dc2626;
          color: white;
        }

        .modal-cancel-button:disabled,
        .modal-delete-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 800px) {

          .events-grid {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 600px) {

          .events-admin-page {
            padding: 20px 12px 60px;
          }

          .events-header {
            align-items: center;
          }

          .events-header h1 {
            font-size: 28px;
          }

          .events-header p {
            font-size: 13px;
          }

          .create-card,
          .events-list-section {
            padding: 18px;
          }

          .card-heading,
          .section-heading {
            flex-direction: column;
          }

          /*
           * Keep the three actions clean on phones too.
           */

          .event-actions {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .event-action-button {
            min-height: 46px;
          }

          .event-dates {
            grid-template-columns: 1fr;
          }

          .delete-actions {
            grid-template-columns: 1fr;
          }

        }

      `}</style>

    </main>
  );
}
