"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminReferralUserPage({
  params
}) {
  const [userId, setUserId] = useState("");

  const [data, setData] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function resolveParams() {
      const resolvedParams = await params;

      setUserId(
        resolvedParams?.userId || ""
      );
    }

    resolveParams();
  }, [params]);


  useEffect(() => {
    if (!userId) return;

    async function loadUser() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/admin/team-expansion/${encodeURIComponent(
            userId
          )}`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
            "Unable to load user referral details."
          );
        }

        setData(result);

      } catch (err) {
        console.error(err);

        setError(
          err.message ||
          "Unable to load user referral details."
        );

      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [userId]);


  if (loading) {
    return (
      <main className="mobile-shell scroll-page">

        <p className="muted">
          Loading user referral information...
        </p>

      </main>
    );
  }


  if (error) {
    return (
      <main className="mobile-shell scroll-page">

        <header className="topbar">

          <div>

            <div className="eyebrow">
              GLOBAL NEXUS CAPITAL ADMIN
            </div>

            <h1>
              User Referral Details
            </h1>

          </div>

          <Link
            href="/admin/team-expansion"
            className="icon-button"
          >
            ←
          </Link>

        </header>

        <p className="auth-error">
          {error}
        </p>

      </main>
    );
  }


  const user = data?.user;

  const sponsor = data?.sponsor;

  const referrals =
    data?.referrals || [];

  const referralCode =
    data?.referralCode || "Not available";


  return (

    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>

          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Referral Details
          </h1>

          <p className="muted">
            Complete referral relationship information
          </p>

        </div>


        <Link
          href="/admin/team-expansion"
          className="icon-button"
        >
          ←
        </Link>

      </header>


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            User Information
          </strong>

          <span className="badge">
            {user?.enabled
              ? "Active"
              : "Disabled"}
          </span>

        </div>


        <p>

          <strong>
            {user?.name ||
              "Unnamed User"}
          </strong>

        </p>


        <p className="muted">

          Phone: {
            user?.phone ||
            "Not available"
          }

        </p>


        <p className="muted">

          Account ID: {
            user?.account_id ||
            "Not available"
          }

        </p>


        <p className="muted">

          Rank: {
            user?.rank_name ||
            "STARTER"
          }

        </p>


        <p className="muted">

          Registration Date: {
            user?.registration_date
              ? new Date(
                  user.registration_date
                ).toLocaleString()
              : "Not available"
          }

        </p>


        <p className="muted">

          User ID:

          <br />

          {user?.id}

        </p>

      </section>


      <section className="mine-stat-grid">

        <div>

          <span>
            Available Balance
          </span>

          <strong>
            GHS {
              Number(
                user?.available_balance || 0
              ).toFixed(2)
            }
          </strong>

        </div>


        <div>

          <span>
            Direct Referrals
          </span>

          <strong>
            {referrals.length}
          </strong>

        </div>

      </section>


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Referral Code
          </strong>

          <span className="badge">
            Global Nexus Capital
          </span>

        </div>


        <div className="referral-box">

          {referralCode}

        </div>


        <p className="muted">

          This is the referral code used to
          connect new members directly to this user.

        </p>

      </section>


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Referred By
          </strong>

          <span className="badge">
            Sponsor
          </span>

        </div>


        {sponsor ? (

          <Link
            href={`/admin/team-expansion/${sponsor.id}`}
            className="list-row"
            style={{
              textDecoration: "none",
              color: "inherit"
            }}
          >

            <div>

              <strong>
                {sponsor.name ||
                  "Global Nexus Capital Member"}
              </strong>


              <span className="muted">

                Account ID: {
                  sponsor.account_id ||
                  "Not available"
                }

              </span>


              <span className="muted">

                Phone: {
                  sponsor.phone ||
                  "Not available"
                }

              </span>

            </div>


            <span>
              →
            </span>

          </Link>

        ) : (

          <div className="empty-document">

            <span>

              This user was not referred
              by another Global Nexus Capital member.

            </span>

          </div>

        )}

      </section>


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Directly Referred Members
          </strong>

          <span className="badge">

            {referrals.length}

          </span>

        </div>


        <p className="muted">

          These members registered directly
          using this user&apos;s referral relationship.

        </p>


        {referrals.length ? (

          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 14
            }}
          >

            {referrals.map(member => (

              <Link
                key={member.id}
                href={`/admin/team-expansion/${member.id}`}
                className="list-row"
                style={{
                  textDecoration: "none",
                  color: "inherit"
                }}
              >

                <div>

                  <strong>

                    {member.name ||
                      "Unnamed User"}

                  </strong>


                  <span className="muted">

                    Account ID: {
                      member.account_id ||
                      "Not available"
                    }

                  </span>


                  <span className="muted">

                    {member.rank_name ||
                      "STARTER"}

                    {" · "}

                    {member.qualified_at
                      ? "Qualified"
                      : "Not Qualified"}

                  </span>

                </div>


                <span>
                  →
                </span>

              </Link>

            ))}

          </div>

        ) : (

          <div className="empty-document">

            <span>

              This user has not directly
              referred any members yet.

            </span>

          </div>

        )}

      </section>


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Referral Root
          </strong>

          <span className="badge">
            Network
          </span>

        </div>


        <p className="muted">

          Referral relationships are connected
          through direct sponsors. Administrators
          can open each sponsor to trace the
          complete referral chain back to its root.

        </p>

      </section>

    </main>

  );
}
