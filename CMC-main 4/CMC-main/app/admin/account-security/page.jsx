"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Security() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  async function load() {
    setStatus("");

    try {
      const response = await fetch("/api/admin/identity-verifications");
      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Unable to load verification requests.");
        return;
      }

      setRows(data.verifications || []);
    } catch {
      setStatus("Unable to load verification requests.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id, action) {
    if (action === "reject" && !rejectionReason.trim()) {
      setStatus("Enter a rejection reason before rejecting this verification.");
      return;
    }

    setBusyId(id);
    setStatus("");

    try {
      const response = await fetch("/api/admin/identity-verifications", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          id,
          action,
          rejectionReason:
            action === "reject"
              ? rejectionReason.trim()
              : undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Unable to process verification.");
        return;
      }

      setStatus(
        data.message ||
          (action === "approve"
            ? "Verification approved."
            : "Verification rejected.")
      );

      setRejectionReason("");
      await load();
    } catch {
      setStatus("Unable to process verification.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="mobile-shell scroll-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">GLOBAL NEXUS CAPITAL ADMIN</div>

          <h1>Account Security</h1>

          <p className="muted">
            Review identity verification requests
          </p>
        </div>

        <Link className="icon-button" href="/admin">
          ←
        </Link>
      </header>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>Pending Verification</strong>

          <span className="badge">
            {rows.length}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="empty-document">
            <span>No pending identity requests</span>
          </div>
        ) : (
          rows.map((v) => (
            <div className="admin-card" key={v.id}>
              <strong>
                {v.name || v.government_name}
              </strong>

              <p className="muted">
                Phone: {v.phone}
              </p>

              <p>
                Government name: {v.government_name}
              </p>

              <p>
                ID number: {v.government_id_number}
              </p>

              <label>
                Rejection reason
                <input
                  value={rejectionReason}
                  onChange={(e) =>
                    setRejectionReason(e.target.value)
                  }
                  placeholder="Only required when rejecting"
                  disabled={busyId === v.id}
                />
              </label>

              <div className="admin-actions">
                <button
                  type="button"
                  onClick={() => act(v.id, "reject")}
                  disabled={busyId === v.id}
                >
                  {busyId === v.id ? "Saving…" : "Reject"}
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => act(v.id, "approve")}
                  disabled={busyId === v.id}
                >
                  {busyId === v.id ? "Saving…" : "Approve"}
                </button>
              </div>
            </div>
          ))
        )}

        {status ? (
          <p className="muted">
            <strong>{status}</strong>
          </p>
        ) : null}
      </section>
    </main>
  );
}
