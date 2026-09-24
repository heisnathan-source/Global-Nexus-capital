"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function getPrizeLabel(prize) {
  const type = String(prize?.prizeType || "").toLowerCase();

  if (type === "points") {
    return `${prize.prizeValue || 0} Points`;
  }

  if (type === "cash") {
    return `Cash Reward: ${prize.prizeValue || 0}`;
  }

  if (
    type === "lucky_draw" ||
    type === "lucky_card" ||
    type === "lucky_cards"
  ) {
    const draws = Number(prize.prizeValue || 1);

    return `${draws} Lucky Card ${
      draws === 1 ? "Draw" : "Draws"
    }`;
  }

  return prize.prizeValue
    ? `${prize.prizeName || "Reward"}: ${prize.prizeValue}`
    : prize.prizeName || "Event Reward";
}

function getStatus(prize) {
  if (prize?.claimed) {
    const status =
      String(prize.claimStatus || "")
        .replace(/_/g, " ")
        .trim();

    if (status) {
      return status;
    }

    return "Credited";
  }

  return "Pending";
}

function getStatusStyle(prize) {
  if (prize?.claimed) {
    return {
      background: "#e8f8ee",
      color: "#198754",
    };
  }

  return {
    background: "#fff4dd",
    color: "#b7791f",
  };
}

export default function Events() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadEvents() {
    try {
      const r = await fetch("/api/events", {
        credentials: "include",
        cache: "no-store",
      });

      const d = await r.json();

      if (r.ok) {
        setRows(d.events || []);
      } else {
        setRows([]);
      }
    } catch (e) {
      console.error("Events load:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">
        <div>
          <div className="eyebrow">Global Nexus Capital</div>
          <h1>Events</h1>
          <p className="muted">
            Current Global Nexus Capital events and your rewards
          </p>
        </div>

        <Link className="icon-button" href="/mine">
          ←
        </Link>
      </header>

      {loading ? (
        <section className="promo-placeholder">
          <strong>Loading events...</strong>
        </section>
      ) : rows.length ? (
        rows.map((e) => (
          <section
            className="promo-placeholder"
            key={e.id}
          >

            {e.banner_url ? (
              <img
                src={e.banner_url}
                alt={e.name}
                style={{
                  width: "100%",
                  display: "block",
                  borderRadius: 14,
                  marginBottom: 14,
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  minHeight: 120,
                  borderRadius: 14,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#1683d8",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                Global Nexus Capital
              </div>
            )}

            <strong
              style={{
                fontSize: 18,
                display: "block",
              }}
            >
              {e.name}
            </strong>

            {e.description && (
              <p className="muted">
                {e.description}
              </p>
            )}

            {Array.isArray(e.prizes) &&
              e.prizes.length > 0 && (
                <div
                  style={{
                    marginTop: 18,
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      marginBottom: 10,
                    }}
                  >
                    Your Event Rewards
                  </strong>

                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    {e.prizes.map((prize) => (
                      <div
                        key={prize.id}
                        style={{
                          padding: 14,
                          borderRadius: 14,
                          background: "#f7f9fc",
                          border:
                            "1px solid #e7ebf0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            alignItems: "flex-start",
                            gap: 12,
                          }}
                        >
                          <div>
                            <strong>
                              {getPrizeLabel(prize)}
                            </strong>

                            {prize.prizeName && (
                              <p
                                className="muted"
                                style={{
                                  margin:
                                    "5px 0 0",
                                  fontSize: 13,
                                }}
                              >
                                {prize.prizeName}
                              </p>
                            )}
                          </div>

                          <span
                            style={{
                              ...getStatusStyle(
                                prize
                              ),
                              padding:
                                "5px 9px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              textTransform:
                                "capitalize",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {getStatus(prize)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

          </section>
        ))
      ) : (
        <section className="promo-placeholder">
          <strong>Events</strong>

          <p className="muted">
            No active events are currently published.
          </p>
        </section>
      )}

    </main>
  );
}
