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

function eventLabel(value) {
  if (value === "login_success") {
    return "Successful login";
  }

  if (value === "login_failed") {
    return "Failed login";
  }

  return value || "Unknown";
}

function failureLabel(value) {
  if (!value) return "";

  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function shortUserAgent(value) {
  if (!value) return "Browser information unavailable";

  return value;
}

export default function UserSecurity() {
  const [activities, setActivities] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadActivities(
    searchValue = search
  ) {
    setLoading(true);
    setError("");

    try {
      const params =
        new URLSearchParams();

      if (searchValue.trim()) {
        params.set(
          "search",
          searchValue.trim()
        );
      }

      params.set("limit", "200");

      const response = await fetch(
        `/api/admin/login-activity?${params.toString()}`,
        {
          cache: "no-store"
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to load login activity."
        );
      }

      setActivities(
        Array.isArray(data.activities)
          ? data.activities
          : []
      );

    } catch (err) {
      setError(
        err.message ||
        "Unable to load login activity."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities("");
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    loadActivities(search);
  }

  function clearSearch() {
    setSearch("");
    loadActivities("");
  }

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>
          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            User Security
          </h1>

          <p className="muted">
            Login activity and IP records
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

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 12
          }}
        >

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search name, phone, IP or ID"
            style={{
              flex: 1,
              minWidth: 0
            }}
          />

          <button
            type="submit"
            className="small-button"
            disabled={loading}
          >
            Search
          </button>

        </form>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginBottom: 12
          }}
        >

          <strong>
            Login activity
          </strong>

          <div
            style={{
              display: "flex",
              gap: 6
            }}
          >

            {search && (
              <button
                type="button"
                className="small-button"
                onClick={clearSearch}
              >
                Clear
              </button>
            )}

            <button
              type="button"
              className="small-button"
              onClick={() =>
                loadActivities(search)
              }
              disabled={loading}
            >
              {loading
                ? "Loading…"
                : "Refresh"}
            </button>

          </div>

        </div>

        {error ? (

          <div className="empty-document">
            <span>{error}</span>
          </div>

        ) : loading ? (

          <div className="empty-document">
            <span>
              Loading security activity…
            </span>
          </div>

        ) : activities.length === 0 ? (

          <div className="empty-document">
            <span>
              No login activity found.
            </span>
          </div>

        ) : (

          <div className="transaction-list">

            {activities.map((activity) => {

              const successful =
                activity.event_type ===
                "login_success";

              return (
                <article
                  className="record-card"
                  key={activity.id}
                >

                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "flex-start",
                      gap: 8
                    }}
                  >

                    <strong>
                      {eventLabel(
                        activity.event_type
                      )}
                    </strong>

                    <span className="badge">
                      {activity.role === "admin"
                        ? "Admin"
                        : "User"}
                    </span>

                  </div>

                  <span>
                    {formatDate(
                      activity.created_at
                    )}
                  </span>

                  <span>
                    Name:{" "}
                    {activity.user_name ||
                      "Unknown"}
                  </span>

                  <span>
                    Phone:{" "}
                    {activity.phone ||
                      "Unavailable"}
                  </span>

                  <span>
                    IP:{" "}
                    <strong>
                      {activity.ip_address ||
                        "Unavailable"}
                    </strong>
                  </span>

                  {activity.account_id && (
                    <span>
                      Account ID:{" "}
                      {activity.account_id}
                    </span>
                  )}

                  {!successful &&
                    activity.failure_reason && (
                      <span>
                        Reason:{" "}
                        {failureLabel(
                          activity.failure_reason
                        )}
                      </span>
                    )}

                  <details
                    style={{
                      marginTop: 6
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        fontSize: 12
                      }}
                    >
                      Browser / device
                    </summary>

                    <div
                      style={{
                        marginTop: 6,
                        padding: 8,
                        borderRadius: 8,
                        background:
                          "#f7faff",
                        fontSize: 10,
                        lineHeight: 1.45,
                        overflowWrap:
                          "anywhere"
                      }}
                    >
                      {shortUserAgent(
                        activity.user_agent
                      )}
                    </div>
                  </details>

                </article>
              );
            })}

          </div>
        )}

      </section>

    </main>
  );
}
