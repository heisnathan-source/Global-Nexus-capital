"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Verifications() {
  const [verifications, setVerifications] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState("");

  async function loadVerifications() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/identity-verifications",
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to load verifications"
        );
      }

      setVerifications(data?.verifications || []);
    } catch (err) {
      setError(
        err.message || "Failed to load verifications"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVerifications();
  }, []);

  async function reviewVerification(id, action) {
    let rejectionReason = "";

    if (action === "reject") {
      rejectionReason = window.prompt(
        "Enter the reason for rejecting this verification:"
      );

      if (!rejectionReason || !rejectionReason.trim()) {
        return;
      }
    }

    const confirmed = window.confirm(
      action === "approve"
        ? "Are you sure you want to APPROVE this verification?"
        : "Are you sure you want to REJECT this verification?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setReviewing(id);
      setError("");

      const response = await fetch(
        "/api/admin/identity-verifications",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            action,
            rejectionReason,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to process verification"
        );
      }

      await loadVerifications();
    } catch (err) {
      setError(
        err.message || "Unable to process verification"
      );
    } finally {
      setReviewing("");
    }
  }

  return (
    <main className="mobile-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">GLOBAL NEXUS CAPITAL ADMIN</div>

          <h1>Identity Verification</h1>

          <p className="muted">
            Review withdrawal activation requests
          </p>
        </div>

        <Link className="icon-button" href="/admin">
          ←
        </Link>
      </header>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>Pending Verifications</strong>

          <span className="badge">
            {verifications.length}
          </span>
        </div>

        {loading && (
          <div className="empty-document">
            <span>
              Loading verification requests...
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="empty-document">
            <span>{error}</span>

            <button
              type="button"
              onClick={loadVerifications}
              className="text-button"
            >
              Try again
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          verifications.length === 0 && (
            <div className="empty-document">
              <span>No pending verification requests</span>
            </div>
          )}

        {!loading &&
          !error &&
          verifications.length > 0 && (
            <div className="verification-list">
              {verifications.map((item) => (
                <article
                  className="verification-item"
                  key={item.id}
                >
                  <div className="verification-name">
                    {item.government_name ||
                      item.name ||
                      "Unknown user"}
                  </div>

                  <div className="verification-detail">
                    <strong>ID Number:</strong>{" "}
                    {item.government_id_number}
                  </div>

                  <div className="verification-detail">
                    <strong>Phone:</strong>{" "}
                    {item.phone || "-"}
                  </div>

                  <div className="verification-detail">
                    <strong>Status:</strong>{" "}
                    {item.status}
                  </div>

                  <div className="verification-detail">
                    <strong>Submitted:</strong>{" "}
                    {item.created_at
                      ? new Date(
                          item.created_at
                        ).toLocaleString()
                      : "-"}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "18px",
                    }}
                  >
                    <button
                      type="button"
                      disabled={reviewing === item.id}
                      onClick={() =>
                        reviewVerification(
                          item.id,
                          "approve"
                        )
                      }
                      style={{
                        flex: 1,
                        padding: "12px",
                        border: "none",
                        borderRadius: "10px",
                        cursor:
                          reviewing === item.id
                            ? "not-allowed"
                            : "pointer",
                        fontWeight: "700",
                        background: "#16803c",
                        color: "white",
                      }}
                    >
                      {reviewing === item.id
                        ? "Processing..."
                        : "✓ Approve"}
                    </button>

                    <button
                      type="button"
                      disabled={reviewing === item.id}
                      onClick={() =>
                        reviewVerification(
                          item.id,
                          "reject"
                        )
                      }
                      style={{
                        flex: 1,
                        padding: "12px",
                        border: "none",
                        borderRadius: "10px",
                        cursor:
                          reviewing === item.id
                            ? "not-allowed"
                            : "pointer",
                        fontWeight: "700",
                        background: "#b42318",
                        color: "white",
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
      </section>
    </main>
  );
}
