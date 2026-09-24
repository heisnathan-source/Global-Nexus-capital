"use client";

import { useEffect, useState } from "react";

export default function TeamView() {
  const [link, setLink] = useState("");

  const [qr, setQr] = useState("");

  const [team, setTeam] = useState({
    directMembers: 0,
    qualifyingMembers: 0,
    members: []
  });

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);


  useEffect(() => {

    async function loadTeam() {
      try {

        const response = await fetch(
          "/api/team-expansion",
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
            "Unable to load team information."
          );
        }

        const referralCode =
          data.referralCode || "";

        setTeam(
          data.team || {
            directMembers: 0,
            qualifyingMembers: 0,
            members: []
          }
        );

        if (referralCode) {

          const referralLink =
            `${window.location.origin}/register?ref=${encodeURIComponent(
              referralCode
            )}`;

          setLink(referralLink);

          setQr(
            `https://quickchart.io/qr?size=220&text=${encodeURIComponent(
              referralLink
            )}`
          );
        }

      } catch (err) {

        setError(
          err.message ||
          "Unable to load team information."
        );

      } finally {

        setLoading(false);
      }
    }

    loadTeam();

  }, []);


  function isQualified(member) {
    return Boolean(
      member?.qualified_at ||
      [
        "qualified",
        "rank_qualified",
        "starter_qualified",
        "active",
        "full_time",
        "full_member"
      ].includes(
        String(
          member?.qualifying_status || ""
        ).toLowerCase()
      )
    );
  }


  async function share() {

    if (!link) return;

    try {

      if (navigator.share) {

        await navigator.share({
          title: "Global Nexus Capital Referral",
          text:
            "Join Global Nexus Capital using my referral link.",
          url: link
        });

      } else {

        await navigator.clipboard.writeText(link);

        alert(
          "Referral link copied successfully."
        );
      }

    } catch (error) {

      console.error(
        "Share error:",
        error
      );
    }
  }


  async function copyLink() {

    if (!link) return;

    try {

      await navigator.clipboard.writeText(link);

      alert(
        "Referral link copied successfully."
      );

    } catch (error) {

      console.error(
        "Copy error:",
        error
      );
    }
  }


  if (loading) {

    return (
      <section className="admin-card">

        <strong>
          Loading team information...
        </strong>

      </section>
    );
  }


  return (

    <>

      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Direct Referral Link
          </strong>

          <span className="badge">
            Direct Only
          </span>

        </div>


        {error ? (

          <p className="auth-error">
            {error}
          </p>

        ) : (

          <>

            <p className="muted">

              Share your Global Nexus Capital referral link.
              Only members directly linked to your
              account are part of your direct team.

            </p>


            <div className="referral-box">

              {link ||
                "Referral link unavailable."}

            </div>


            {qr && (

              <div className="qr-wrap">

                <img
                  src={qr}
                  alt="Global Nexus Capital referral QR code"
                />

                <small className="muted">

                  Scan to register using
                  this referral link.

                </small>

              </div>

            )}


            <div className="admin-actions">

              <button
                type="button"
                className="primary-button"
                onClick={share}
                disabled={!link}
              >
                Share Referral Link
              </button>


              <button
                type="button"
                onClick={copyLink}
                disabled={!link}
              >
                Copy Link
              </button>

            </div>

          </>

        )}

      </section>


      <section className="mine-stat-grid">

        <div>

          <span>
            Direct Members
          </span>

          <strong>
            {team.directMembers ?? 0}
          </strong>

        </div>


        <div>

          <span>
            Qualified Members
          </span>

          <strong>
            {team.qualifyingMembers ?? 0}
          </strong>

        </div>

      </section>


      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            My Direct Team
          </strong>

          <span>
            {team.directMembers ?? 0}
          </span>

        </div>


        {team.members?.length ? (

          team.members.map((member) => {

            const qualified =
              isQualified(member);

            return (

              <div
                className="list-row"
                key={member.referred_user_id}
              >

                <div>

                  <strong>
                    {member.name || "Global Nexus Capital Member"}
                  </strong>

                  <span className="muted">

                    {member.rank_name || "No Rank"}

                    {" · "}

                    {qualified
                      ? "Qualified"
                      : "Not qualified"}

                  </span>

                </div>

              </div>

            );
          })

        ) : (

          <div className="empty-document">

            <span>
              Your directly linked members
              will appear here.
            </span>

          </div>

        )}

      </section>

    </>

  );
}
