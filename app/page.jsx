"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const features = [
  ["Company Activity", "/company-activity"],
  ["Employee Office", "/employee-office"],
  ["Member Benefits", "/member-benefits"],
  ["Management Positions", "/management-positions"],
  ["Team Expansion", "/team-expansion"],
  ["Raffle Tickets", "/lucky-cards"],
  ["Events", "/events"],
  ["Bonus Draw", "/bonus-draw"],
  ["Fund Products", "/fund-products"],
  ["Deposit", "/deposit"],
  ["Social Security Fund", "/fund-products"],
];

function formatMemberId(id) {
  if (!id) return "CMC-—";

  const clean = String(id).replace(/-/g, "").toUpperCase();

  if (clean.length <= 8) {
    return `CMC-${clean}`;
  }

  return `CMC-${clean.slice(-8)}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-GB");
}

export default function Home() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [promotion, setPromotion] = useState(null);

  const [loginPopup, setLoginPopup] = useState(null);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [loginPopupLoading, setLoginPopupLoading] = useState(true);

  useEffect(() => {
    async function loadAccount() {
      try {
        const response = await fetch("/api/account", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load account.");
        }

        const data = await response.json();

        setAccount(data.account || data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, []);

  useEffect(() => {
    async function loadPromotion() {
      try {
        const response = await fetch(
          "/api/content?key=home_promotion",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        setPromotion(data.content || null);
      } catch (error) {
        console.error("Homepage promotion:", error);
      }
    }

    loadPromotion();
  }, []);

  /*
   * Load the admin-controlled Login Popup.
   *
   * The popup is only displayed when the admin has:
   * 1. Created the Login Popup
   * 2. Set it to Active
   */
  useEffect(() => {
    async function loadLoginPopup() {
      try {
        setLoginPopupLoading(true);

        const response = await fetch(
          "/api/content?key=login_popup",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          setLoginPopup(null);
          return;
        }

        const data = await response.json();

        const content = data.content || data;

        if (
          content &&
          content.active === true
        ) {
          setLoginPopup(content);
          setShowLoginPopup(true);
        } else {
          setLoginPopup(null);
          setShowLoginPopup(false);
        }
      } catch (error) {
        console.error(
          "Login popup:",
          error
        );

        setLoginPopup(null);
        setShowLoginPopup(false);
      } finally {
        setLoginPopupLoading(false);
      }
    }

    loadLoginPopup();
  }, []);

  /*
   * Prevent the user from interacting with
   * the homepage while the Login Popup is open.
   *
   * The popup can only be dismissed by tapping
   * the X button.
   */
  useEffect(() => {
    if (!showLoginPopup) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [showLoginPopup]);

  function closeLoginPopup() {
    setShowLoginPopup(false);
  }

  const balance = Number(
    account?.balance ??
    account?.available_balance ??
    account?.wallet_balance ??
    0
  );

  const registrationDate =
    account?.created_at ||
    account?.registration_date;

  const rank =
    account?.rank_name ||
    account?.rank ||
    "STARTER";

  const memberId = formatMemberId(account?.id);

  return (
    <main className="mobile-shell scroll-page">

      {/* HEADER */}
      <header className="topbar">
        <div>
          <div className="eyebrow">Global Nexus Capital</div>

          <h1>Welcome back</h1>

          <p className="muted">
            Your account overview
          </p>
        </div>

        <Link
          className="icon-button"
          href="/settings"
          aria-label="Settings"
        >
          ⚙
        </Link>
      </header>

      {/* ACCOUNT BALANCE */}
      <section className="balance-card">

        <span>Account Balance</span>

        <strong>
          GHS{" "}
          {loading
            ? "—"
            : balance.toLocaleString("en-GH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
        </strong>

        <div className="account-meta">

          <div>
            <span>Registration Date</span>

            <strong>
              {formatDate(registrationDate)}
            </strong>
          </div>

          <div>
            <span>Rank</span>

            <strong>
              {rank}
            </strong>
          </div>

        </div>

        <div className="home-money-actions">

          <Link href="/deposit">
            Deposit
          </Link>

          <Link href="/withdrawal">
            Withdrawal
          </Link>

        </div>

      </section>

      {/* ACCOUNT INFORMATION */}
      <section className="admin-card">

        <div className="account-info-row">
          <div>
            <strong>Global Nexus Capital Member ID</strong>

            <small>
              {memberId}
            </small>
          </div>
        </div>

        {account?.phone && (
          <div className="account-info-row">
            <div>
              <strong>Phone Number</strong>

              <small>
                {account.phone}
              </small>
            </div>
          </div>
        )}

      </section>

      {/* GET MORE POSITIONS */}
      <section className="promo-placeholder">

        <strong>
          Get More Positions
        </strong>

        <p className="muted">
          Move up through the Global Nexus Capital ranks to unlock
          higher earning opportunities.
        </p>

        <Link
          href="/rank"
          className="primary-button"
        >
          View Rank
        </Link>

      </section>

      {/* FEATURES */}
      <section>

        <div className="section-title">
          <h2>Global Nexus Capital Features</h2>
        </div>

        <div className="feature-grid">

          {features.map(([label, href]) => (
            <Link
              href={href}
              className="feature-card"
              key={label}
            >
              <span className="feature-icon">
                ✦
              </span>

              <span>
                {label}
              </span>
            </Link>
          ))}

        </div>

      </section>

      {/* PROMOTION */}
      {promotion?.active !== false && (
        <section className="promo-placeholder">

          <strong>
            {promotion?.title || "Promotion"}
          </strong>

          {promotion?.banner_url && (
            <img
              src={promotion.banner_url}
              alt={
                promotion?.title ||
                "Global Nexus Capital Promotion"
              }
              style={{
                width: "100%",
                display: "block",
                marginTop: 12,
                borderRadius: 16,
              }}
            />
          )}

          {promotion?.content && (
            <p
              className="muted"
              style={{
                whiteSpace: "pre-wrap",
                marginTop: 10,
              }}
            >
              {promotion.content}
            </p>
          )}

          {!promotion?.banner_url &&
            !promotion?.content && (
              <p className="muted">
                Admin promotional content
                will appear here.
              </p>
            )}

        </section>
      )}

      {/* BOTTOM NAVIGATION */}
      <nav className="bottom-nav">

        <Link
          className="active"
          href="/"
        >
          Home
        </Link>

        <Link href="/tasks">
          Task
        </Link>

        <Link href="/message">
          Message
        </Link>

        <Link href="/rank">
          Rank
        </Link>

        <Link href="/mine">
          Mine
        </Link>

      </nav>

      {/* =====================================================
          LOGIN POPUP
          ===================================================== */}

      {showLoginPopup &&
        loginPopup &&
        !loginPopupLoading && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cmc-login-popup-title"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background:
                "rgba(0, 0, 0, 0.68)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 18,
            }}
          >

            <section
              style={{
                width: "100%",
                maxWidth: 430,
                maxHeight: "88vh",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: 22,
                boxShadow:
                  "0 24px 70px rgba(0,0,0,.30)",
                position: "relative",
                overflow: "hidden",
              }}
            >

              {/* CLOSE X */}

              <button
                type="button"
                onClick={closeLoginPopup}
                aria-label="Close announcement"
                style={{
                  position: "absolute",
                  right: 12,
                  bottom: 12,
                  zIndex: 5,
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  border:
                    "1px solid rgba(0,0,0,.12)",
                  background:
                    "rgba(255,255,255,.96)",
                  color: "#172b4d",
                  fontSize: 25,
                  lineHeight: 1,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow:
                    "0 6px 18px rgba(0,0,0,.16)",
                }}
              >
                ×
              </button>

              {/* POPUP IMAGE */}

              {loginPopup.banner_url && (
                <img
                  src={loginPopup.banner_url}
                  alt={
                    loginPopup.title ||
                    "Global Nexus Capital Announcement"
                  }
                  style={{
                    width: "100%",
                    display: "block",
                    maxHeight: 420,
                    objectFit: "cover",
                  }}
                />
              )}

              {/* POPUP CONTENT */}

              <div
                style={{
                  padding:
                    loginPopup.banner_url
                      ? "18px 18px 76px"
                      : "28px 18px 76px",
                }}
              >

                <div
                  className="eyebrow"
                  style={{
                    marginBottom: 6,
                  }}
                >
                  Global Nexus Capital ANNOUNCEMENT
                </div>

                <h2
                  id="cmc-login-popup-title"
                  style={{
                    margin:
                      "0 0 12px",
                    fontSize: 23,
                    lineHeight: 1.2,
                    color: "#172b4d",
                  }}
                >
                  {loginPopup.title ||
                    "Global Nexus Capital Announcement"}
                </h2>

                {loginPopup.content && (
                  <p
                    className="muted"
                    style={{
                      margin: 0,
                      whiteSpace:
                        "pre-wrap",
                      lineHeight: 1.65,
                      fontSize: 15,
                    }}
                  >
                    {loginPopup.content}
                  </p>
                )}

              </div>

            </section>

          </div>
        )}

    </main>
  );
}
