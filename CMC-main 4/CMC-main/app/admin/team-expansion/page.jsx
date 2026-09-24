"use client";

import Link from "next/link";
import { useState } from "react";

export default function TeamExpansionAdmin() {
  const [query, setQuery] = useState("");

  const [users, setUsers] = useState([]);

  const [loading, setLoading] =
    useState(false);

  const [searched, setSearched] =
    useState(false);

  const [error, setError] =
    useState("");


  async function searchUsers() {
    const searchQuery =
      query.trim();

    if (!searchQuery) {
      setError(
        "Enter a name, phone number, Account ID, or User ID."
      );

      setUsers([]);
      setSearched(false);

      return;
    }

    try {
      setLoading(true);
      setError("");
      setUsers([]);
      setSearched(true);

      const response =
        await fetch(
          `/api/admin/users/search?q=${encodeURIComponent(
            searchQuery
          )}`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to search users."
        );
      }

      setUsers(
        data.users || []
      );

    } catch (err) {
      console.error(
        "TEAM EXPANSION SEARCH ERROR:",
        err
      );

      setError(
        err.message ||
        "Unable to search users."
      );

    } finally {
      setLoading(false);
    }
  }


  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();

      searchUsers();
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
            Team Expansion
          </h1>

          <p className="muted">
            Search users and inspect the complete
            Global Nexus Capital referral network.
          </p>

        </div>


        <Link
          className="icon-button"
          href="/admin"
        >
          ←
        </Link>

      </header>


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Referral Network Search
          </strong>

          <span className="badge">
            Admin Access
          </span>

        </div>


        <p className="muted">

          Search for any Global Nexus Capital user to see who
          referred them, who they referred, and
          trace their referral relationship.

        </p>


        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 16
          }}
        >

          <input
            type="text"

            value={query}

            placeholder={
              "Name, phone, Account ID or User ID"
            }

            onChange={event =>
              setQuery(event.target.value)
            }

            onKeyDown={handleKeyDown}

            style={{
              flex: "1 1 220px"
            }}
          />


          <button
            type="button"
            className="primary-button"

            onClick={searchUsers}

            disabled={loading}
          >

            {loading
              ? "Searching..."
              : "Search Users"}

          </button>

        </div>


        {error && (

          <p
            className="auth-error"
            style={{
              marginTop: 14
            }}
          >

            {error}

          </p>

        )}

      </section>


      {searched &&
        !loading &&
        !error &&
        users.length === 0 && (

          <section className="admin-card">

            <div className="empty-document">

              <span>
                No Global Nexus Capital users were found
                matching your search.
              </span>

            </div>

          </section>

        )}


      {users.length > 0 && (

        <section className="admin-card">

          <div className="admin-card-head">

            <strong>
              Search Results
            </strong>

            <span className="badge">
              {users.length}
            </span>

          </div>


          <p className="muted">

            Tap a user to open their complete
            referral information.

          </p>


          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 16
            }}
          >

            {users.map(user => (

              <Link
                key={user.id}

                href={
                  `/admin/team-expansion/${user.id}`
                }

                className="list-row"

                style={{
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer"
                }}
              >

                <div>

                  <strong>

                    {user.name ||
                      "Unnamed User"}

                  </strong>


                  <span className="muted">

                    Account ID: {
                      user.account_id ||
                      "Not available"
                    }

                  </span>


                  <span className="muted">

                    Phone: {
                      user.phone ||
                      "Not available"
                    }

                  </span>


                  <span className="muted">

                    Rank: {
                      user.rank_name ||
                      "STARTER"
                    }

                  </span>

                </div>


                <span
                  style={{
                    fontSize: 22
                  }}
                >
                  →
                </span>

              </Link>

            ))}

          </div>

        </section>

      )}


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Referral System
          </strong>

          <span className="badge">
            Global Nexus Capital Network
          </span>

        </div>


        <p className="muted">

          Every user has a unique referral code.
          When a new member registers using that
          code, the system records the direct
          sponsor relationship.

        </p>


        <p className="muted">

          From a user&apos;s referral details page,
          you can move upward through their
          sponsors or downward through members
          they directly referred.

        </p>

      </section>

    </main>

  );
}
