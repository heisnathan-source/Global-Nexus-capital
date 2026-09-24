"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PasswordRecoveryPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [resetPhone, setResetPhone] = useState("");

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/password-recovery",
        {
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load recovery requests."
        );
      }

      setRequests(data.requests || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load recovery requests."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function updateRequest(requestId, action, phone) {
    const actionText =
      action === "reset"
        ? "reset this user's password"
        : "cancel this recovery request";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText}?`
    );

    if (!confirmed) {
      return;
    }

    setBusyId(requestId);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/password-recovery",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            requestId,
            action
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to update this request."
        );
      }

      if (action === "reset" && data.temporaryPassword) {
        setTemporaryPassword(data.temporaryPassword);
        setResetPhone(phone || "");
      }

      await loadRequests();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update this request."
      );
    } finally {
      setBusyId("");
    }
  }

  async function copyTemporaryPassword() {
    try {
      await navigator.clipboard.writeText(
        temporaryPassword
      );
      window.alert("Temporary password copied.");
    } catch {
      window.alert(
        "Unable to copy automatically. Please copy the password manually."
      );
    }
  }

  function closePasswordBox() {
    setTemporaryPassword("");
    setResetPhone("");
  }

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">
        <div>
          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>Password Recovery</h1>

          <p className="muted">
            Manage user password recovery requests.
          </p>
        </div>

        <Link
          href="/admin"
          className="icon-button"
        >
          Back
        </Link>
      </header>

      {temporaryPassword ? (
        <section className="admin-card">
          <div className="admin-card-head">
            <strong>
              Password Reset Successful
            </strong>

            <button
              type="button"
              className="icon-button"
              onClick={closePasswordBox}
            >
              Close
            </button>
          </div>

          <p className="muted">
            A new temporary password has been generated
            {resetPhone ? ` for ${resetPhone}` : ""}.
          </p>

          <div
            style={{
              marginTop: 14,
              padding: 14,
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 12,
              wordBreak: "break-all"
            }}
          >
            <strong>
              Temporary Password:
            </strong>

            <div
              style={{
                marginTop: 8,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 1
              }}
            >
              {temporaryPassword}
            </div>
          </div>

          <p
            className="muted"
            style={{ marginTop: 12 }}
          >
            Copy this password and give it securely to the user.
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={copyTemporaryPassword}
            style={{ marginTop: 8 }}
          >
            Copy Password
          </button>
        </section>
      ) : null}

      {error ? (
        <section className="admin-card">
          <p className="auth-error">
            {error}
          </p>
        </section>
      ) : null}

      <section className="admin-card">

        <div className="admin-card-head">
          <strong>
            Recovery Requests
          </strong>

          <button
            type="button"
            className="icon-button"
            onClick={loadRequests}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p className="muted">
            Loading requests...
          </p>
        ) : requests.length === 0 ? (
          <p className="muted">
            No password recovery requests yet.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 12
            }}
          >

            {requests.map((request) => {

              const phone =
                request.phone ||
                request.registered_phone ||
                "Hidden phone";

              return (
                <article
                  key={request.id}
                  className="admin-card"
                  style={{ margin: 0 }}
                >

                  <div className="admin-card-head">

                    <strong>
                      {phone}
                    </strong>

                    <span className="badge">
                      {request.status}
                    </span>

                  </div>

                  <div className="account-meta">
                    <span>
                      Requested:{" "}
                      {request.created_at
                        ? new Date(
                            request.created_at
                          ).toLocaleString()
                        : "Unknown"}
                    </span>
                  </div>

                  {request.handled_at ? (
                    <div className="account-meta">
                      <span>
                        Processed:{" "}
                        {new Date(
                          request.handled_at
                        ).toLocaleString()}
                      </span>
                    </div>
                  ) : null}

                  {request.status === "pending" ? (

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 12,
                        flexWrap: "wrap"
                      }}
                    >

                      <button
                        type="button"
                        className="primary-button"
                        disabled={
                          busyId === request.id
                        }
                        onClick={() =>
                          updateRequest(
                            request.id,
                            "reset",
                            phone
                          )
                        }
                      >
                        {busyId === request.id
                          ? "Processing..."
                          : "Reset Password"}
                      </button>

                      <button
                        type="button"
                        className="icon-button"
                        disabled={
                          busyId === request.id
                        }
                        onClick={() =>
                          updateRequest(
                            request.id,
                            "cancelled",
                            phone
                          )
                        }
                      >
                        Cancel
                      </button>

                    </div>

                  ) : null}

                </article>
              );
            })}

          </div>
        )}

      </section>

    </main>
  );
}
