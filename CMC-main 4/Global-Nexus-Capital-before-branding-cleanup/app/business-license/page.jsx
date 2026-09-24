"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function InformationCard({ title, content, fallback }) {
  return (
    <section className="admin-card">
      {content?.banner_url && (
        <img
          src={content.banner_url}
          alt={`Global Nexus Capital ${title}`}
          style={{
            width: "100%",
            borderRadius: 16,
            marginBottom: 16,
          }}
        />
      )}

      <h2>{title}</h2>

      {content?.active === false ? (
        <p className="muted">
          This information is currently unavailable.
        </p>
      ) : (
        <p
          className="muted"
          style={{
            whiteSpace: "pre-wrap",
          }}
        >
          {content?.content || fallback}
        </p>
      )}
    </section>
  );
}

export default function BusinessLicense() {
  const [license, setLicense] = useState(null);
  const [security, setSecurity] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/content?key=business_certificate", {
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : null)),

      fetch("/api/content?key=business_license", {
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([licenseData, securityData]) => {
        setLicense(licenseData?.content || null);
        setSecurity(securityData?.content || null);
      })
      .catch(() => {});
  }, []);

  return (
    <main className="mobile-shell scroll-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">Global Nexus Capital</div>

          <h1>Business License</h1>

          <p className="muted">
            Official Global Nexus Capital company information
          </p>
        </div>

        <Link
          className="icon-button"
          href="/mine"
        >
          ←
        </Link>
      </header>

      <InformationCard
        title="Business License"
        content={license}
        fallback="Global Nexus Capital business license information will appear here when published by Admin."
      />

      <InformationCard
        title="Business Security"
        content={security}
        fallback="Global Nexus Capital business security information will appear here when published by Admin."
      />
    </main>
  );
}
