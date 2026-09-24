"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function BusinessSecurity() {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadCertificate() {
    try {
      const r = await fetch("/api/admin/content", {
        cache: "no-store",
      });

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.error || "Unable to load certificate."
        );
      }

      const certificate = (d.pages || []).find(
        (page) => page.page_key === "business_license"
      );

      if (certificate) {
        setSaved(certificate);
        setUrl(certificate.banner_url || "");
      }

    } catch (e) {
      setStatus(
        e.message || "Unable to load certificate."
      );
    }
  }

  useEffect(() => {
    loadCertificate();
  }, []);

  async function save() {
    try {
      setBusy(true);
      setStatus("");

      let u = url;

      if (file) {
        const fd = new FormData();

        fd.append("file", file);
        fd.append("folder", "business-security");

        const upload = await fetch(
          "/api/admin/media",
          {
            method: "POST",
            body: fd,
          }
        );

        const uploadData =
          await upload.json();

        if (!upload.ok) {
          throw new Error(
            uploadData.error ||
            "Unable to upload certificate."
          );
        }

        u = uploadData.url;
      }

      if (!u) {
        throw new Error(
          "Please choose a certificate before saving."
        );
      }

      const r = await fetch(
        "/api/admin/content",
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json",
          },

          body: JSON.stringify({
            pageKey: "business_license",
            title: "Business Security",
            content:
              "Official Global Nexus Capital company certificate",
            bannerUrl: u,
            active: true,
          }),
        }
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.error ||
          "Unable to save certificate."
        );
      }

      setSaved(d.page);
      setUrl(d.page.banner_url || "");
      setFile(null);

      setStatus(
        saved
          ? "Certificate updated successfully."
          : "Certificate saved successfully."
      );

    } catch (e) {
      setStatus(
        e.message ||
        "Unable to save certificate."
      );

    } finally {
      setBusy(false);
    }
  }

  async function removeCertificate() {
    const confirmed = window.confirm(
      "Are you sure you want to remove the company certificate?"
    );

    if (!confirmed) return;

    try {
      setBusy(true);
      setStatus("");

      const r = await fetch(
        "/api/admin/content?key=business_license",
        {
          method: "DELETE",
        }
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.error ||
          "Unable to remove certificate."
        );
      }

      setSaved(null);
      setUrl("");
      setFile(null);

      setStatus(
        "Certificate removed successfully."
      );

    } catch (e) {
      setStatus(
        e.message ||
        "Unable to remove certificate."
      );

    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>
          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Business Security
          </h1>

          <p className="muted">
            Manage the company certificate
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

        <strong>
          Company Certificate
        </strong>

        <p className="muted">
          Upload, replace, or remove the certificate
          users see on the Business Security page.
        </p>

        {saved?.banner_url && (
          <div
            style={{
              margin: "16px 0",
            }}
          >

            <p
              className="muted"
              style={{
                marginBottom: 8,
              }}
            >
              Current certificate
            </p>

            <img
              src={saved.banner_url}
              alt="Current Global Nexus Capital certificate"
              style={{
                width: "100%",
                borderRadius: 16,
                maxHeight: 420,
                objectFit: "contain",
                background: "#f5f7fa",
              }}
            />

          </div>
        )}

        <div className="form-card">

          <label>
            {saved
              ? "Replace Certificate"
              : "Certificate"}

            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) =>
                setFile(
                  e.target.files?.[0] || null
                )
              }
            />
          </label>

          {file && (
            <p className="muted">
              Selected: {file.name}
            </p>
          )}

          <button
            className="primary-button"
            type="button"
            onClick={save}
            disabled={busy}
          >
            {busy
              ? "Saving..."
              : saved
                ? "Update Certificate"
                : "Save Certificate"}
          </button>

          {saved && (
            <button
              type="button"
              onClick={removeCertificate}
              disabled={busy}
              style={{
                width: "100%",
                marginTop: 10,
                minHeight: 46,
                border: "1px solid #f1b5b5",
                borderRadius: 12,
                background: "#fff5f5",
                color: "#c53030",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Remove Certificate
            </button>
          )}

          {status && (
            <p className="muted">
              {status}
            </p>
          )}

        </div>

      </section>

    </main>
  );
}
