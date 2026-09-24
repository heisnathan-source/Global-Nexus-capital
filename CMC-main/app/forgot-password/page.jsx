"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPassword() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();

    setMessage("");
    setError("");
    setBusy(true);

    try {
      const response = await fetch(
        "/api/auth/password-recovery-request",
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            phone: phone.replace(/\s/g, "")
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to submit your password recovery request."
        );
      }

      setMessage(
        data.message ||
        "Your password recovery request has been submitted for review."
      );

      setPhone("");

    } catch (err) {

      setError(
        err.message ||
        "Unable to submit your password recovery request."
      );

    } finally {

      setBusy(false);

    }
  }

  return (
    <main className="mobile-shell">
      <section className="login-card">

        <div className="eyebrow">Global Nexus Capital</div>

        <h1>Reset Password</h1>

        <p className="muted">
          Enter your registered phone number to request
          administrator-assisted password recovery.
        </p>

        <form onSubmit={submit}>

          <label>
            Registered phone number

            <input
              required
              inputMode="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
            />

          </label>

          {message && (
            <p className="success-message">
              {message}
            </p>
          )}

          {error && (
            <p className="auth-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={busy}
          >
            {busy
              ? "Submitting…"
              : "Submit Recovery Request"}
          </button>

        </form>

        <Link
          href="/login"
          className="text-link"
        >
          Back to sign in
        </Link>

      </section>
    </main>
  );
}
