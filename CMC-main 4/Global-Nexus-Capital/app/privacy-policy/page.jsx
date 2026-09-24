"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PrivacyPolicy() {
  const [content, setContent] = useState(null);

  useEffect(() => {
    fetch("/api/content?key=privacy_policy", {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content || null);
      })
      .catch(() => {});
  }, []);

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">
        <div>
          <div className="eyebrow">Global Nexus Capital</div>

          <h1>
            {content?.title || "Privacy Policy"}
          </h1>

          <p className="muted">
            Global Nexus Capital privacy information
          </p>
        </div>

        <Link
          className="icon-button"
          href="/mine"
        >
          ←
        </Link>
      </header>

      <article className="document-page">

        {content?.banner_url && (
          <img
            src={content.banner_url}
            alt="Global Nexus Capital Privacy Policy"
            style={{
              width: "100%",
              borderRadius: 16,
              marginBottom: 16,
            }}
          />
        )}

        <h2>
          {content?.title || "Privacy Policy"}
        </h2>

        {content?.active === false ? (
          <p className="muted">
            This content is currently unavailable.
          </p>
        ) : (
          <p className="muted">
            {content?.content ||
              "Privacy policy information will appear here when published by Admin."}
          </p>
        )}

      </article>

    </main>
  );
}
