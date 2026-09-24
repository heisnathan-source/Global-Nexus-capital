"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLogin() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();

    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          phone: phone.replace(/\s/g, ""),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to sign in.");
      }

      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <img
          className="cmc-auth-logo"
          src="/cmc-login-logo.jpeg"
          alt="Global Nexus Capital"
        />

        <div className="auth-heading">
          <div className="eyebrow">GLOBAL NEXUS CAPITAL ADMIN</div>

          <h1>Admin Login</h1>

          <p className="muted">
            Authorized administrators only.
          </p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            Admin phone number

            <input
              required
              inputMode="tel"
              autoComplete="username"
              placeholder="Admin phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <label>
            Admin password

            <input
              required
              type="password"
              autoComplete="current-password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button
            className="auth-primary"
            type="submit"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign In to Admin"}
          </button>
        </form>

        <p className="auth-security-note">
          There is no public Admin signup. Admin accounts must be
          provisioned by an authorized system administrator.
        </p>

        <Link href="/login" className="text-link">
          Back to User Login
        </Link>
      </section>
    </main>
  );
}
