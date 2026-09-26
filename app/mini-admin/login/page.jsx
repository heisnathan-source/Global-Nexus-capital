"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerificationLoginPage() {
  const router = useRouter();

  const [staffLogin, setStaffLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function login(event) {
    event.preventDefault();

    setError("");

    const loginNumber = staffLogin.trim().replace(/\s+/g, "");

    if (!loginNumber) {
      setError("Enter your staff login number.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    setWorking(true);

    try {
      const response = await fetch("/api/auth/verification-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staffLogin: loginNumber,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to sign in.");
      }

      router.replace("/mini-admin");
      router.refresh();
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="mobile-shell scroll-page">
      <section
        className="admin-card"
        style={{
          maxWidth: 480,
          margin: "60px auto",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <img
            src="/cmc-login-logo.jpeg"
            alt="Global Nexus Capital"
            style={{
              width: "100%",
              maxWidth: 360,
              height: "auto",
              display: "block",
              margin: "0 auto 24px",
              borderRadius: 16,
            }}
          />

          <div className="eyebrow">
            Global Nexus Capital VERIFICATION
          </div>

          <h1>Mini Admin</h1>

          <p className="muted">
            Deposit and withdrawal verification portal
          </p>
        </div>

        {error ? (
          <div
            className="admin-card"
            style={{
              marginBottom: 16,
              background: "rgba(255,255,255,.72)",
            }}
          >
            <strong>Error</strong>
            <p className="muted">{error}</p>
          </div>
        ) : null}

        <form onSubmit={login}>
          <label className="field-label">
            Staff login number
          </label>

          <input
            className="text-input"
            value={staffLogin}
            onChange={(event) =>
              setStaffLogin(event.target.value)
            }
            placeholder="Login number"
            inputMode="tel"
            autoComplete="username"
            disabled={working}
          />

          <label className="field-label">
            Password
          </label>

          <input
            className="text-input"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Password"
            autoComplete="current-password"
            disabled={working}
          />

          <button
            className="primary-button"
            type="submit"
            disabled={working}
            style={{ width: "100%" }}
          >
            {working ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}
