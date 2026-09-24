"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState
} from "react";

export default function WithdrawalFrequencyPage() {

  const [users, setUsers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    processingId,
    setProcessingId
  ] = useState(null);

  const [error, setError] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [search, setSearch] =
    useState("");


  async function loadUsers() {

    setLoading(true);
    setError("");

    try {

      const response =
        await fetch(
          "/api/admin/withdrawal-frequency-users",
          {
            cache: "no-store"
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to load users."
        );
      }

      setUsers(
        data.users || []
      );

    } catch (error) {

      setError(
        error.message
      );

    } finally {

      setLoading(false);

    }

  }


  useEffect(() => {

    loadUsers();

  }, []);


  async function updateUser(
    user,
    exempt
  ) {

    if (processingId) return;

    setProcessingId(user.id);
    setError("");
    setStatus("");

    try {

      const response =
        await fetch(
          "/api/admin/withdrawal-frequency-users",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json"
            },

            body: JSON.stringify({
              userId: user.id,
              exempt
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to update user."
        );
      }

      setUsers(previous =>
        previous.map(item =>
          item.id === user.id
            ? data.user
            : item
        )
      );

      setStatus(
        exempt
          ? `${user.name || "User"} can now make multiple withdrawals within 24 hours.`
          : `${user.name || "User"} is now limited to one withdrawal every 24 hours.`
      );

    } catch (error) {

      setError(
        error.message
      );

    } finally {

      setProcessingId(null);

    }

  }


  const filteredUsers =
    useMemo(() => {

      const query =
        search.trim().toLowerCase();

      if (!query) return users;

      return users.filter(user =>

        String(user.name || "")
          .toLowerCase()
          .includes(query) ||

        String(user.phone || "")
          .toLowerCase()
          .includes(query) ||

        String(user.account_id || "")
          .toLowerCase()
          .includes(query)

      );

    }, [
      users,
      search
    ]);


  const allowedCount =
    users.filter(
      user =>
        user.withdrawal_frequency_exempt
    ).length;


  return (

    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>

          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Multiple Withdrawals
          </h1>

          <p className="muted">
            Manage users allowed to bypass the one withdrawal per 24 hours rule
          </p>

        </div>


        <Link
          className="icon-button"
          href="/admin/withdrawals"
        >
          ←
        </Link>

      </header>


      {error && (

        <section className="admin-card">

          <p className="auth-error">
            {error}
          </p>

        </section>

      )}


      {status && (

        <section className="admin-card">

          <p className="success-message">
            {status}
          </p>

        </section>

      )}


      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <section className="admin-card">

        <div className="admin-card-head">

          <div>

            <strong>
              Multiple Withdrawals Allowed
            </strong>

            <p className="muted">

              Users selected here can submit
              more than one withdrawal request
              within 24 hours.

            </p>

          </div>


          <span className="badge">

            {allowedCount}

          </span>

        </div>


        <p className="muted permission-note">

          This permission only bypasses the
          one withdrawal per 24 hours rule.
          All other withdrawal rules still apply.

        </p>

      </section>


      {/* ================================================= */}
      {/* SEARCH */}
      {/* ================================================= */}

      <section className="admin-card">

        <label>

          Search user

          <input
            type="text"
            placeholder="Search by name, phone or account ID..."
            value={search}
            onChange={event =>
              setSearch(
                event.target.value
              )
            }
          />

        </label>

      </section>


      {/* ================================================= */}
      {/* USER LIST */}
      {/* ================================================= */}

      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            User Permissions
          </strong>


          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
          >

            {loading
              ? "Loading..."
              : "Refresh"}

          </button>

        </div>


        {loading ? (

          <p className="muted">

            Loading users...

          </p>

        ) : filteredUsers.length === 0 ? (

          <div className="empty-document">

            <span>
              No users found
            </span>

          </div>

        ) : (

          <div className="permission-list">

            {filteredUsers.map(user => {

              const allowed =
                Boolean(
                  user.withdrawal_frequency_exempt
                );

              const processing =
                processingId === user.id;

              return (

                <div
                  key={user.id}
                  className="permission-row"
                >

                  <div className="user-details">

                    <strong>

                      {user.name ||
                        "Unnamed User"}

                    </strong>


                    <span>

                      {user.phone ||
                        "No phone number"}

                    </span>


                    {user.account_id && (

                      <small>

                        ID: {user.account_id}

                      </small>

                    )}


                    <small
                      className={
                        allowed
                          ? "permission-status allowed"
                          : "permission-status normal"
                      }
                    >

                      {allowed
                        ? "Multiple withdrawals allowed"
                        : "Once every 24 hours"}

                    </small>

                  </div>


                  <button
                    type="button"
                    disabled={processing}
                    className={
                      `permission-switch ${
                        allowed
                          ? "allowed"
                          : "not-allowed"
                      }`
                    }
                    onClick={() =>
                      updateUser(
                        user,
                        !allowed
                      )
                    }
                  >

                    {processing
                      ? "..."
                      : allowed
                        ? "ON"
                        : "OFF"}

                  </button>

                </div>

              );

            })}

          </div>

        )}

      </section>


      <style jsx>{`

        .permission-note {
          margin-top: 14px;
          line-height: 1.55;
        }

        .permission-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 14px;
        }

        .permission-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;

          padding: 15px;

          border-radius: 16px;

          background:
            rgba(245, 247, 251, .9);

          border:
            1px solid
            rgba(40, 60, 90, .06);
        }

        .user-details {
          display: flex;
          flex-direction: column;
          gap: 4px;

          min-width: 0;
        }

        .user-details strong {
          color: #26334a;
        }

        .user-details span,
        .user-details small {
          color: #7c8798;
          font-size: 12px;
        }

        .permission-status {
          margin-top: 4px;
          font-weight: 700;
        }

        .permission-status.allowed {
          color: #21834a;
        }

        .permission-status.normal {
          color: #8c96a5;
        }

        .permission-switch {
          min-width: 70px;

          border: none;

          border-radius: 999px;

          padding: 11px 15px;

          color: white;

          font-weight: 800;

          cursor: pointer;

          flex-shrink: 0;
        }

        .permission-switch.allowed {
          background: #21834a;
        }

        .permission-switch.not-allowed {
          background: #8c96a5;
        }

        .permission-switch:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

      `}</style>

    </main>

  );

}
