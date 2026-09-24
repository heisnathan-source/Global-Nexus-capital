"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AppDownload() {
  const [content, setContent] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    fetch("/api/content?key=app_download", {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content || null);
      })
      .catch(() => {});

    const userAgent = window.navigator.userAgent || "";

    const ios =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === "MacIntel" &&
        navigator.maxTouchPoints > 1);

    const android = /Android/i.test(userAgent);

    setIsIOS(ios);
    setIsAndroid(android);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    setInstalled(standalone);

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled
      );
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      if (isIOS) {
        setShowIOSHelp(true);
      }
      return;
    }

    try {
      await installPrompt.prompt();

      await installPrompt.userChoice;

      setInstallPrompt(null);
    } catch {
      setInstallPrompt(null);
    }
  }

  return (
    <main className="mobile-shell scroll-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">Global Nexus Capital</div>

          <h1>Global Nexus Capital App</h1>

          <p className="muted">
            Install Global Nexus Capital directly on your device
          </p>
        </div>

        <Link
          className="icon-button"
          href="/mine"
        >
          ←
        </Link>
      </header>

      <section className="admin-card">
        <img
          src="/icons/icon-512x512.jpeg"
          alt="Global Nexus Capital"
          style={{
            width: 110,
            height: 110,
            objectFit: "cover",
            borderRadius: 24,
            display: "block",
            margin: "0 auto 20px",
          }}
        />

        <div
          style={{
            textAlign: "center",
          }}
        >
          <strong
            style={{
              display: "block",
              fontSize: 22,
              marginBottom: 8,
            }}
          >
            Global Nexus Capital
          </strong>

          <p className="muted">
            Use Global Nexus Capital like an app from your device Home Screen.
          </p>
        </div>

        {installed ? (
          <div
            className="admin-card"
            style={{
              marginTop: 20,
              background: "rgba(34,197,94,.10)",
            }}
          >
            <strong>Global Nexus Capital is installed</strong>

            <p className="muted">
              Global Nexus Capital is already running in app mode on this device.
            </p>
          </div>
        ) : null}

        {!installed && installPrompt ? (
          <button
            type="button"
            className="primary-button"
            onClick={installApp}
            style={{
              width: "100%",
              marginTop: 20,
            }}
          >
            📲 Install Global Nexus Capital App
          </button>
        ) : null}

        {!installed && isIOS ? (
          <div
            className="admin-card"
            style={{
              marginTop: 20,
            }}
          >
            <strong>
              Install Global Nexus Capital on iPhone or iPad
            </strong>

            <p className="muted">
              Apple does not allow websites to install apps
              silently. You can add Global Nexus Capital to your Home Screen
              directly from Safari.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                setShowIOSHelp((current) => !current)
              }
              style={{
                width: "100%",
              }}
            >
              {showIOSHelp
                ? "Hide Instructions"
                : "Show Install Instructions"}
            </button>

            {showIOSHelp ? (
              <div
                style={{
                  marginTop: 18,
                  lineHeight: 1.7,
                }}
              >
                <p>
                  <strong>1.</strong> Open Global Nexus Capital in Safari.
                </p>

                <p>
                  <strong>2.</strong> Tap the{" "}
                  <strong>Share</strong> button.
                </p>

                <p>
                  <strong>3.</strong> Scroll down and tap{" "}
                  <strong>Add to Home Screen</strong>.
                </p>

                <p>
                  <strong>4.</strong> Confirm by tapping{" "}
                  <strong>Add</strong>.
                </p>

                <p className="muted">
                  Global Nexus Capital will then appear on your Home Screen
                  with the Global Nexus Capital logo and open in app mode.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {!installed &&
        !installPrompt &&
        !isIOS ? (
          <div
            className="admin-card"
            style={{
              marginTop: 20,
            }}
          >
            <strong>
              Add Global Nexus Capital to your Home Screen
            </strong>

            <p className="muted">
              Open Global Nexus Capital using a supported browser. When your
              browser supports installation, an install
              option will appear here or in the browser&apos;s
              menu.
            </p>

            {isAndroid ? (
              <p className="muted">
                On Android, use Chrome and look for{" "}
                <strong>Install app</strong> or{" "}
                <strong>Add to Home screen</strong> in the
                browser menu.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="admin-card">
        <strong>
          Global Nexus Capital App Information
        </strong>

        <p className="muted">
          {content?.active === false
            ? "App download information is currently unavailable."
            : content?.content ||
              "Global Nexus Capital can be installed directly from your browser without Google Play or the App Store."}
        </p>

        {content?.banner_url ? (
          <a
            href={content.banner_url}
            target="_blank"
            rel="noreferrer"
            className="primary-button"
            style={{
              display: "inline-flex",
              marginTop: 8,
            }}
          >
            Open Information
          </a>
        ) : null}
      </section>
    </main>
  );
}
