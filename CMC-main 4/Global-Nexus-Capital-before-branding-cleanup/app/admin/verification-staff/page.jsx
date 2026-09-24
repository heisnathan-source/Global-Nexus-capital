"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function VerificationStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [name, setName] = useState("");
  const [staffLogin, setStaffLogin] = useState("");
  const [password, setPassword] = useState("");

  async function loadStaff() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/verification-staff",
        {
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load staff."
        );
      }

      setStaff(
        Array.isArray(data.staff)
          ? data.staff
          : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load staff."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  async function createStaff(event) {
    event.preventDefault();

    setError("");
    setStatus("");

    const cleanName =
      name.trim();

    const cleanLogin =
      staffLogin
        .trim()
        .replace(/\s+/g, "");

    const cleanPassword =
      password;

    if (!cleanName) {
      setError(
        "Enter the staff member's name."
      );
      return;
    }

    if (!cleanLogin) {
      setError(
        "Enter the staff login number."
      );
      return;
    }

    if (cleanPassword.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (
      !window.confirm(
        `Create a verification staff account for ${cleanName}?`
      )
    ) {
      return;
    }

    setWorking("create");

    try {
      const response =
        await fetch(
          "/api/admin/verification-staff",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name: cleanName,
              staffLogin: cleanLogin,
              password:
                cleanPassword,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create staff account."
        );
      }

      setName("");
      setStaffLogin("");
      setPassword("");

      setStatus(
        "Verification staff account created successfully."
      );

      await loadStaff();
    } catch (err) {
      setError(
        err.message ||
          "Unable to create staff account."
      );
    } finally {
      setWorking("");
    }
  }

  async function toggleStaff(member) {
    const action =
      member.enabled
        ? "disable"
        : "enable";

    if (
      !window.confirm(
        `${
          action === "disable"
            ? "Disable"
            : "Enable"
        } ${member.name}'s verification staff account?`
      )
    ) {
      return;
    }

    setError("");
    setStatus("");
    setWorking(
      `account-${member.id}`
    );

    try {
      const response =
        await fetch(
          "/api/admin/verification-staff",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              staffId: member.id,
              enabled:
                !member.enabled,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update staff account."
        );
      }

      setStatus(
        `${member.name}'s account has been ${
          !member.enabled
            ? "enabled"
            : "disabled"
        }.`
      );

      await loadStaff();
    } catch (err) {
      setError(
        err.message ||
          "Unable to update staff account."
      );
    } finally {
      setWorking("");
    }
  }

  async function toggleReportExclusion(
    member
  ) {
    const next =
      !Boolean(
        member.staff_report_exclusion_enabled
      );

    const action =
      next
        ? "allow"
        : "remove";

    if (
      !window.confirm(
        `${action === "allow" ? "Allow" : "Remove"} report exclusion permission for ${member.name}?`
      )
    ) {
      return;
    }

    setError("");
    setStatus("");

    setWorking(
      `report-${member.id}`
    );

    try {
      const response =
        await fetch(
          "/api/admin/verification-staff",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              staffId: member.id,
              staffReportExclusionEnabled:
                next,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update report permission."
        );
      }

      setStatus(
        `${member.name}'s report exclusion permission has been ${
          next
            ? "enabled"
            : "disabled"
        }.`
      );

      await loadStaff();
    } catch (err) {
      setError(
        err.message ||
          "Unable to update report permission."
      );
    } finally {
      setWorking("");
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
            Verification Staff
          </h1>

          <p className="muted">
            Manage staff who can verify
            deposits and process
            withdrawals.
          </p>
        </div>

        <Link
          className="icon-button"
          href="/admin"
        >
          ←
        </Link>
      </header>

      {error ? (
        <div
          className="admin-card"
          style={{
            marginBottom: 12,
          }}
        >
          <strong>Error</strong>

          <p className="muted">
            {error}
          </p>
        </div>
      ) : null}

      {status ? (
        <div
          className="admin-card"
          style={{
            marginBottom: 12,
          }}
        >
          <strong>
            Success
          </strong>

          <p className="muted">
            {status}
          </p>
        </div>
      ) : null}

      <section className="admin-card">
        <div className="section-heading">
          <div>
            <h2>
              Create Staff Account
            </h2>

            <p className="muted">
              This account will only
              be able to use the
              verification portal.
            </p>
          </div>
        </div>

        <form
          onSubmit={createStaff}
        >
          <label className="field-label">
            Staff name
          </label>

          <input
            className="text-input"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            placeholder="Full name"
            autoComplete="name"
          />

          <label className="field-label">
            Staff login number
          </label>

          <input
            className="text-input"
            value={staffLogin}
            onChange={(event) =>
              setStaffLogin(
                event.target.value
              )
            }
            placeholder="Login number"
            inputMode="tel"
            autoComplete="tel"
          />

          <label className="field-label">
            Login password
          </label>

          <input
            className="text-input"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            placeholder="Minimum 6 characters"
            autoComplete="new-password"
          />

          <button
            className="primary-button"
            type="submit"
            disabled={
              working === "create"
            }
          >
            {working === "create"
              ? "Creating..."
              : "Create Staff Account"}
          </button>
        </form>
      </section>

      <section className="admin-card">
        <div className="section-heading">
          <div>
            <h2>
              Staff Accounts
            </h2>

            <p className="muted">
              {staff.length} verification
              staff account
              {staff.length === 1
                ? ""
                : "s"}.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={loadStaff}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="muted">
            Loading staff accounts...
          </p>
        ) : staff.length === 0 ? (
          <p className="muted">
            No verification staff
            accounts yet.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {staff.map(
              (member) => (
                <div
                  key={member.id}
                  style={{
                    border:
                      "1px solid rgba(0,0,0,.08)",
                    borderRadius: 14,
                    padding: 14,
                    background:
                      "rgba(255,255,255,.72)",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      gap: 12,
                      alignItems:
                        "flex-start",
                    }}
                  >
                    <div>
                      <strong>
                        {member.name}
                      </strong>

                      <div
                        className="muted"
                        style={{
                          marginTop: 4,
                        }}
                      >
                        Login:{" "}
                        {
                          member.staff_login
                        }
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding:
                          "5px 9px",
                        borderRadius: 999,
                        border:
                          "1px solid rgba(0,0,0,.08)",
                      }}
                    >
                      {member.enabled
                        ? "ACTIVE"
                        : "DISABLED"}
                    </span>
                  </div>

                  <div
                    className="muted"
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                    }}
                  >
                    Created{" "}
                    {member.created_at
                      ? new Date(
                          member.created_at
                        ).toLocaleString()
                      : "—"}
                  </div>

                  <button
                    type="button"
                    className={
                      member.enabled
                        ? "secondary-button"
                        : "primary-button"
                    }
                    style={{
                      marginTop: 12,
                    }}
                    disabled={
                      working ===
                      `account-${member.id}`
                    }
                    onClick={() =>
                      toggleStaff(
                        member
                      )
                    }
                  >
                    {working ===
                    `account-${member.id}`
                      ? "Updating..."
                      : member.enabled
                      ? "Disable Staff"
                      : "Enable Staff"}
                  </button>

                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop:
                        "1px solid rgba(0,0,0,.08)",
                    }}
                  >
                    <div>
                      <strong>
                        Staff Report
                        Exclusion
                      </strong>

                      <p
                        className="muted"
                        style={{
                          margin:
                            "4px 0 10px",
                          fontSize: 13,
                        }}
                      >
                        Allows this staff
                        member to choose
                        which transactions
                        are excluded from
                        staff reports.
                      </p>
                    </div>

                    <button
                      type="button"
                      className={
                        member.staff_report_exclusion_enabled
                          ? "primary-button"
                          : "secondary-button"
                      }
                      disabled={
                        working ===
                        `report-${member.id}`
                      }
                      onClick={() =>
                        toggleReportExclusion(
                          member
                        )
                      }
                    >
                      {working ===
                      `report-${member.id}`
                        ? "Updating..."
                        : member.staff_report_exclusion_enabled
                        ? "Exclusion Permission: ON"
                        : "Exclusion Permission: OFF"}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </main>
  );
}
