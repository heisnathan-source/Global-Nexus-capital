"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

function isBlockedPath(pathname) {
  return (
    pathname === "/login" ||
    pathname === "/admin/login" ||
    pathname === "/mini-admin/login" ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/mini-admin" ||
    pathname.startsWith("/mini-admin/")
  );
}

export default function LoginPopup() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  const [popup, setPopup] = useState(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadPopup = useCallback(async () => {
    if (isBlockedPath(pathname)) {
      setPopup(null);
      setVisible(false);
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "/api/login-popup",
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        setPopup(null);
        setVisible(false);
        return;
      }

      const data = await response.json();

      const nextPopup =
        data?.popup || null;

      setPopup(nextPopup);

      setVisible(
        nextPopup?.active === true
      );
    } catch (error) {
      console.error(
        "Login popup error:",
        error
      );

      setPopup(null);
      setVisible(false);
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  /*
   * If an already-authenticated user opens
   * the website directly, load the popup.
   */
  useEffect(() => {
    if (!isBlockedPath(pathname)) {
      loadPopup();
    }

    // Intentionally run once on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Detect the transition:
   *
   * /login -> /
   *
   * This is what makes the popup appear after
   * a successful login without reopening it on
   * every ordinary page navigation.
   */
  useEffect(() => {
    const wasBlocked =
      isBlockedPath(
        previousPathname.current
      );

    const isNowBlocked =
      isBlockedPath(pathname);

    if (
      wasBlocked &&
      !isNowBlocked
    ) {
      loadPopup();
    }

    if (isNowBlocked) {
      setVisible(false);
      setPopup(null);
    }

    previousPathname.current =
      pathname;
  }, [pathname, loadPopup]);

  /*
   * Extra support for any authentication flow
   * that dispatches this event.
   */
  useEffect(() => {
    function handleLoginSuccess() {
      if (!isBlockedPath(pathname)) {
        loadPopup();
      }
    }

    window.addEventListener(
      "cmc-login-success",
      handleLoginSuccess
    );

    return () => {
      window.removeEventListener(
        "cmc-login-success",
        handleLoginSuccess
      );
    };
  }, [pathname, loadPopup]);

  /*
   * Lock scrolling while the popup is open.
   */
  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [visible]);

  function closePopup() {
    setVisible(false);
  }

  if (
    loading ||
    !visible ||
    !popup ||
    isBlockedPath(pathname)
  ) {
    return null;
  }

  const title =
    popup.title ||
    "Global Nexus Capital Announcement";

  const message =
    popup.content || "";

  const image =
    popup.banner_url || "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cmc-login-popup-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background:
          "rgba(8,18,34,.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "18px 12px",
        boxSizing: "border-box",
      }}
    >
      <section
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          position: "relative",
          width:
            "min(100%, 560px)",
          maxHeight:
            "calc(100vh - 36px)",
          overflowY: "auto",
          borderRadius: 28,
          background:
            "linear-gradient(180deg,#eaf3ff 0%,#ffffff 42%,#ffffff 100%)",
          boxShadow:
            "0 24px 80px rgba(0,0,0,.42)",
          border:
            "1px solid rgba(255,255,255,.95)",
          padding:
            "28px 18px 88px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: "#13284a",
          }}
        >
          <h2
            id="cmc-login-popup-title"
            style={{
              margin:
                "0 0 12px",
              fontSize:
                "clamp(27px,7vw,42px)",
              lineHeight: 1.08,
              fontWeight: 900,
              letterSpacing:
                "-.5px",
              wordBreak:
                "break-word",
            }}
          >
            {title}
          </h2>

          {message ? (
            <div
              style={{
                margin:
                  "0 auto",
                maxWidth: 500,
                color: "#526783",
                fontSize:
                  "clamp(16px,4.2vw,22px)",
                lineHeight: 1.55,
                whiteSpace:
                  "pre-wrap",
                wordBreak:
                  "break-word",
              }}
            >
              {message}
            </div>
          ) : null}

          {image ? (
            <div
              style={{
                marginTop: 20,
                width: "100%",
                borderRadius: 20,
                overflow: "hidden",
                background:
                  "#edf3fc",
              }}
            >
              <img
                src={image}
                alt={title}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight:
                    "55vh",
                  objectFit:
                    "contain",
                }}
              />
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={closePopup}
          aria-label="Close Global Nexus Capital announcement"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 14,
            transform:
              "translateX(-50%)",
            width: 60,
            height: 60,
            borderRadius:
              "50%",
            border:
              "2px solid rgba(255,255,255,.95)",
            background:
              "#0d3158",
            color: "#ffffff",
            fontSize: 32,
            lineHeight: 1,
            fontWeight: 400,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            boxShadow:
              "0 8px 24px rgba(13,49,88,.34)",
          }}
        >
          ×
        </button>
      </section>
    </div>
  );
}
