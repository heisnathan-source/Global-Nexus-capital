"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const pages = [
  [
    "login_popup",
    "Login Popup",
    "Announcement shown to users immediately after a successful Global Nexus Capital login.",
  ],
  [
    "company_activity",
    "Company Activity",
    "Official activities and banners",
  ],
  [
    "promotional_brochure",
    "Promotional Brochure",
    "Promotional banner shown to users",
  ],
  [
    "business_license",
    "Business Security",
    "Company certificate and business information",
  ],
  [
    "business_certificate",
    "Business Certificate",
    "Official Global Nexus Capital company certificate",
  ],
  [
    "home_promotion",
    "Homepage Promotion",
    "Homepage promotional banner",
  ],
  [
    "privacy_policy",
    "Privacy Policy",
    "Privacy policy shown to users",
  ],
  [
    "app_download",
    "App Download",
    "App download information or link",
  ],
  [
    "points_rewards",
    "Points Rewards",
    "Points rewards available to users",
  ],
];

const emptyLoginPopup = {
  title: "",
  content: "",
  banner_url: "",
  active: true,
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GB");
}

export default function ContentAdmin() {
  const [values, setValues] = useState({});
  const [files, setFiles] = useState({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [removingKey, setRemovingKey] = useState("");

  function set(key, value) {
    setValues((current) => ({
      ...current,
      [key]: {
        ...(current[key] || {}),
        ...value,
      },
    }));
  }

  async function load() {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/admin/content",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load content."
        );
      }

      const mapped = {};

      (data.pages || []).forEach((page) => {
        mapped[page.page_key] = page;
      });

      setValues(mapped);
    } catch (error) {
      setStatus(
        error.message ||
          "Unable to load content."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function uploadImage(file) {
    if (!file) {
      return "";
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("folder", "content");

    const response = await fetch(
      "/api/admin/media",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Unable to upload file."
      );
    }

    return data.url || "";
  }

  async function save(key, defaultTitle) {
    try {
      setSavingKey(key);
      setStatus("");

      const value = values[key] || {};

      let bannerUrl =
        value.banner_url || null;

      const file = files[key];

      /*
       * Upload selected image/PDF first.
       */
      if (file) {
        bannerUrl =
          await uploadImage(file);
      }

      /*
       * Login Popup has an editable title.
       * Existing content sections keep
       * their original fixed title.
       */
      const title =
        key === "login_popup"
          ? String(
              value.title || ""
            ).trim()
          : defaultTitle;

      if (
        key === "login_popup" &&
        !title
      ) {
        throw new Error(
          "Login Popup title is required."
        );
      }

      const response = await fetch(
        "/api/admin/content",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            pageKey: key,
            title,
            content:
              value.content || "",
            bannerUrl,
            active:
              key === "login_popup"
                ? value.active === true
                : value.active !== false,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to save content."
        );
      }

      set(key, {
        title,
        banner_url: bannerUrl,
        content:
          value.content || "",
        active:
          key === "login_popup"
            ? value.active === true
            : value.active !== false,
      });

      setFiles((current) => ({
        ...current,
        [key]: null,
      }));

      setStatus(
        `${title} saved successfully.`
      );

      await load();
    } catch (error) {
      setStatus(
        error.message ||
          "Unable to save content."
      );
    } finally {
      setSavingKey("");
    }
  }

  async function toggleActive(
    key,
    defaultTitle
  ) {
    try {
      const value =
        values[key] || {};

      /*
       * Login Popup must be configured
       * before it can be turned on.
       */
      if (
        key === "login_popup" &&
        !values[key]
      ) {
        setStatus(
          "Create the Login Popup first before turning it on."
        );
        return;
      }

      if (
        key === "login_popup" &&
        !String(
          value.title || ""
        ).trim()
      ) {
        setStatus(
          "Add a Login Popup title before turning it on."
        );
        return;
      }

      const title =
        key === "login_popup"
          ? String(
              value.title || ""
            ).trim()
          : defaultTitle;

      const newActive =
        key === "login_popup"
          ? value.active !== true
          : value.active === false;

      const response = await fetch(
        "/api/admin/content",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            pageKey: key,
            title,
            content:
              value.content || "",
            bannerUrl:
              value.banner_url ||
              null,
            active: newActive,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to change status."
        );
      }

      setStatus(
        `${title} is now ${
          newActive
            ? "active"
            : "inactive"
        }.`
      );

      await load();
    } catch (error) {
      setStatus(
        error.message ||
          "Unable to change status."
      );
    }
  }

  async function removeLoginPopup() {
    const confirmed =
      window.confirm(
        "Remove the Login Popup? Users will no longer see it after login."
      );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingKey(
        "login_popup"
      );

      setStatus("");

      const response = await fetch(
        "/api/admin/content?key=login_popup",
        {
          method: "DELETE",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to remove Login Popup."
        );
      }

      setValues((current) => {
        const next = {
          ...current,
        };

        delete next.login_popup;

        return next;
      });

      setFiles((current) => {
        const next = {
          ...current,
        };

        delete next.login_popup;

        return next;
      });

      setStatus(
        "Login Popup removed successfully."
      );
    } catch (error) {
      setStatus(
        error.message ||
          "Unable to remove Login Popup."
      );
    } finally {
      setRemovingKey("");
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
            Content Management
          </h1>

          <p className="muted">
            Manage content displayed on
            the Global Nexus Capital user website.
          </p>
        </div>

        <Link
          className="icon-button"
          href="/admin"
          aria-label="Back to admin"
        >
          ←
        </Link>
      </header>

      {loading && (
        <p className="muted">
          Loading content...
        </p>
      )}

      {pages.map(
        ([
          key,
          defaultTitle,
          description,
        ]) => {
          const isLoginPopup =
            key === "login_popup";

          const value =
            values[key] ||
            (isLoginPopup
              ? emptyLoginPopup
              : {});

          const configured =
            Boolean(values[key]);

          const active =
            isLoginPopup
              ? configured &&
                value.active === true
              : value.active !== false;

          return (
            <section
              className="admin-card"
              key={key}
            >

              <div className="admin-card-head">

                <div>
                  <strong>
                    {isLoginPopup
                      ? "Login Popup"
                      : defaultTitle}
                  </strong>

                  <p className="muted">
                    {description}
                  </p>
                </div>

                <span className="badge">
                  {isLoginPopup &&
                  !configured
                    ? "Not configured"
                    : active
                      ? "Active"
                      : "Off"}
                </span>

              </div>

              <div className="form-card">

                {isLoginPopup && (
                  <label>
                    Popup title

                    <input
                      value={
                        value.title ||
                        ""
                      }
                      placeholder="e.g. Global Nexus Capital Announcement"
                      onChange={(e) =>
                        set(key, {
                          title:
                            e.target
                              .value,
                        })
                      }
                    />
                  </label>
                )}

                <label>
                  Content

                  <textarea
                    value={
                      value.content ||
                      ""
                    }
                    placeholder={
                      isLoginPopup
                        ? "Write the announcement shown to users after login..."
                        : ""
                    }
                    onChange={(e) =>
                      set(key, {
                        content:
                          e.target
                            .value,
                      })
                    }
                  />
                </label>

                <label>
                  Upload image/file

                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      setFiles(
                        (current) => ({
                          ...current,
                          [key]:
                            e.target
                              .files?.[0] ||
                            null,
                        })
                      )
                    }
                  />
                </label>

                {value.banner_url && (
                  <div
                    style={{
                      marginTop: 10,
                    }}
                  >
                    <small className="muted">
                      Current file:
                    </small>

                    <a
                      href={
                        value.banner_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display:
                          "block",
                        marginTop: 6,
                      }}
                    >
                      View current file
                    </a>
                  </div>
                )}

                {isLoginPopup &&
                  value.updated_at && (
                    <small className="muted">
                      Last updated:{" "}
                      {formatDate(
                        value.updated_at
                      )}
                    </small>
                  )}

                <button
                  className="primary-button"
                  type="button"
                  disabled={
                    savingKey === key
                  }
                  onClick={() =>
                    save(
                      key,
                      defaultTitle
                    )
                  }
                >
                  {savingKey === key
                    ? "Saving..."
                    : `Save ${
                        isLoginPopup
                          ? "Login Popup"
                          : defaultTitle
                      }`}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    isLoginPopup &&
                    !configured
                  }
                  onClick={() =>
                    toggleActive(
                      key,
                      defaultTitle
                    )
                  }
                >
                  {active
                    ? `Turn Off ${
                        isLoginPopup
                          ? "Login Popup"
                          : defaultTitle
                      }`
                    : `Turn On ${
                        isLoginPopup
                          ? "Login Popup"
                          : defaultTitle
                      }`}
                </button>

                {isLoginPopup &&
                  configured && (
                    <button
                      type="button"
                      disabled={
                        removingKey ===
                        "login_popup"
                      }
                      onClick={
                        removeLoginPopup
                      }
                      style={{
                        width: "100%",
                        minHeight: 46,
                        marginTop: 4,
                        border:
                          "1px solid #ef4444",
                        borderRadius: 12,
                        background:
                          "#fff",
                        color:
                          "#b42318",
                        fontWeight: 800,
                        cursor:
                          "pointer",
                      }}
                    >
                      {removingKey ===
                      "login_popup"
                        ? "Removing..."
                        : "Remove Login Popup"}
                    </button>
                  )}

              </div>
            </section>
          );
        }
      )}

      {status && (
        <section className="admin-card">
          <p
            style={{
              margin: 0,
            }}
          >
            {status}
          </p>
        </section>
      )}

    </main>
  );
}
