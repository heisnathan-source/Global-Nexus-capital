"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();

    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
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

      router.push("/");
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
          <div className="eyebrow">Global Nexus Capital</div>

          <h1>Welcome back</h1>

          <p className="muted">
            Sign in to your Global Nexus Capital account.
          </p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            Phone number

            <input
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. 024 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <label>
            Password

            <div className="password-input-wrap">
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
                title={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button
            className="auth-primary"
            type="submit"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <Link href="/forgot-password" className="text-link">
          Forgot password?
        </Link>

        <div className="auth-divider">
          <span>New to Global Nexus Capital?</span>
        </div>

        <Link href="/register" className="auth-secondary">
          Create an account
        </Link>
      </section>
    </main>
  );
}
