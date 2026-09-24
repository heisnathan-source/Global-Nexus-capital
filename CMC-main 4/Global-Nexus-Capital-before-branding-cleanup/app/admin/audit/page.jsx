"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
}

function prettyAction(value) {
  return String(value || "Admin action")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function detailText(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function Audit() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/audit?limit=100", {
        cache: "no-store"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load audit events."
        );
      }

      setEvents(
        Array.isArray(data.events)
          ? data.events
          : []
      );
    } catch (err) {
      setError(
        err.message ||
        "Unable to load audit events."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">
        <div>
          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>Audit Log</h1>

          <p className="muted">
            Track important Admin actions
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

          <strong>
            Recent activity
          </strong>

          <button
            className="small-button"
            type="button"
            onClick={load}
            disabled={loading}
          >
            {loading
              ? "Loading…"
              : "Refresh"}
          </button>

        </div>

        {error ? (

          <div className="empty-document">
            <span>{error}</span>
          </div>

        ) : loading ? (

          <div className="empty-document">
            <span>
              Loading audit events…
            </span>
          </div>

        ) : events.length === 0 ? (

          <div className="empty-document">
            <span>
              No audit events recorded yet.
            </span>
          </div>

        ) : (

          <div className="transaction-list">

            {events.map((event, index) => {

              const details =
                detailText(event.details);

              return (
                <article
                  className="record-card"
                  key={`${event.source}-${event.event_id}-${index}`}
                >

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start"
                    }}
                  >

                    <strong>
                      {prettyAction(event.action)}
                    </strong>

                    <span className="badge">
                      {event.source === "audit_log"
                        ? "Audit"
                        : "Admin"}
                    </span>

                  </div>

                  <span>
                    {formatDate(event.occurred_at)}
                  </span>

                  <span>
                    Admin:{" "}
                    {event.admin_name ||
                      event.admin_phone ||
                      event.admin_user_id ||
                      "Unknown"}
                  </span>

                  {event.entity_type && (
                    <span>
                      Target:{" "}
                      {event.entity_type}

                      {event.target_id
                        ? ` #${event.target_id}`
                        : ""}
                    </span>
                  )}

                  {event.reason && (
                    <span>
                      Reason: {event.reason}
                    </span>
                  )}

                  {details && (
                    <pre
                      style={{
                        margin: "8px 0 0",
                        padding: 10,
                        borderRadius: 10,
                        background: "#f7faff",
                        overflowX: "auto",
                        fontSize: 10,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word"
                      }}
                    >
                      {details}
                    </pre>
                  )}

                </article>
              );
            })}

          </div>
        )}

      </section>

    </main>
  );
}
