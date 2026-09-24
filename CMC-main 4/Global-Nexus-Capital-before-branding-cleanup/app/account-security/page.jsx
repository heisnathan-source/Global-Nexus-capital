"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AccountSecurity() {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    async function loadSecurity() {
      try {
        const response = await fetch("/api/identity-verifications");
        const data = await response.json();

        if (data.verification) {
          setName(data.verification.government_name || "");
          setId(data.verification.government_id_number || "");
          setStatus(data.verification.status || "pending");
        }
      } catch {
        // Keep page usable even if verification data cannot load.
      }
    }

    loadSecurity();
  }, []);

  async function submit(e) {
    e.preventDefault();

    setBusy(true);
    setStatus("");

    try {
      const response = await fetch(
        "/api/identity-verifications",
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            governmentName: name,
            idNumber: id
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to submit verification."
        );
      }

      setStatus(
        data.verification?.status || "pending"
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to submit verification."
      );
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();

    setPasswordMessage("");
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError(
        "Enter your current or temporary password."
      );
      return;
    }

    if (!newPassword) {
      setPasswordError(
        "Enter your new password."
      );
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(
        "Your new password must be at least 6 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        "Your new passwords do not match."
      );
      return;
    }

    setPasswordBusy(true);

    try {
      const response = await fetch(
        "/api/change-password",
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            currentPassword,
            newPassword
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to change password."
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setPasswordMessage(
        "Your login password has been changed successfully. You can now use your new password."
      );
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Unable to change password."
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">
        <div>
          <div className="eyebrow">
            Global Nexus Capital
          </div>

          <h1>
            Account Security
          </h1>

          <p className="muted">
            Manage your identity verification and account security.
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

        <div className="admin-card-head">
          <strong>
            Change Login Password
          </strong>

          <span className="badge">
            Security
          </span>
        </div>

        <p className="muted">
          If an administrator reset your password, enter the temporary password below and create your own new password.
        </p>

        <form
          className="form-card"
          onSubmit={changePassword}
        >

          <label>
            Current Password

            <input
              type="password"
              value={currentPassword}
              onChange={(e) =>
                setCurrentPassword(e.target.value)
              }
              placeholder="Enter current or temporary password"
              autoComplete="current-password"
              required
            />
          </label>

          <label>
            New Password

            <input
              type="password"
              value={newPassword}
              onChange={(e) =>
                setNewPassword(e.target.value)
              }
              placeholder="Create your new password"
              autoComplete="new-password"
              required
            />
          </label>

          <label>
            Confirm New Password

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              placeholder="Enter your new password again"
              autoComplete="new-password"
              required
            />
          </label>

          {passwordError ? (
            <p className="auth-error">
              {passwordError}
            </p>
          ) : null}

          {passwordMessage ? (
            <p className="muted">
              <strong>
                {passwordMessage}
              </strong>
            </p>
          ) : null}

          <button
            type="submit"
            className="primary-button"
            disabled={passwordBusy}
          >
            {passwordBusy
              ? "Changing Password..."
              : "Change Password"}
          </button>

        </form>

      </section>

      <section className="admin-card">

        <div className="admin-card-head">
          <strong>
            Verify Your Identity
          </strong>

          <span className="badge">
            Required for withdrawal
          </span>
        </div>

        <p className="muted">
          Enter your government name and ID number. Admin must approve your information before withdrawal can be activated.
        </p>

        <form
          className="form-card"
          onSubmit={submit}
        >

          <label>
            Government Name

            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              required
              placeholder="Enter your government name"
            />
          </label>

          <label>
            ID Number

            <input
              value={id}
              onChange={(e) =>
                setId(e.target.value)
              }
              required
              placeholder="Enter your ID number"
            />
          </label>

          {status ? (
            <p className="muted">
              Status:{" "}
              <strong>
                {status}
              </strong>
            </p>
          ) : null}

          <button
            type="submit"
            className="primary-button"
            disabled={busy}
          >
            {busy
              ? "Submitting..."
              : "Submit for Verification"}
          </button>

        </form>

      </section>

      <section className="admin-card">

        <strong>
          Funds Password
        </strong>

        <p className="muted">
          Your 6-digit Funds Password is created automatically when you first open Withdrawal. It is never displayed here.
        </p>

      </section>

    </main>
  );
}
