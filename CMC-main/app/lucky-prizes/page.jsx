"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function LuckyPrizesPage() {
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadPrizes() {
    try {
      setLoading(true);

      const response = await fetch("/api/lucky-prizes", {
        cache: "no-store"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load raffle prize history."
        );
      }

      setPrizes(data.prizes || []);

    } catch (error) {
      setMessage(
        error.message || "Unable to load raffle prize history."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrizes();
  }, []);

  function formatAmount(amount) {
    const number = Number(amount || 0);

    return number.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  function formatDate(date) {
    if (!date) return "";

    return new Date(date).toLocaleString();
  }

  function prizeValue(prize) {
    if (prize.prize_type === "cash") {
      return `GH₵${formatAmount(prize.prize_amount)}`;
    }

    if (prize.prize_type === "points") {
      return `${formatAmount(prize.prize_amount)} Points`;
    }

    return "Physical Prize";
  }

  function statusText(prize) {
    if (prize.prize_type === "cash") {
      return "Credited to your account";
    }

    if (prize.prize_type === "points") {
      return "Points credited to your account";
    }

    if (prize.fulfillment_status === "fulfilled") {
      return "Prize fulfilled";
    }

    if (prize.fulfillment_status === "contacted") {
      return "Admin has contacted you about this prize";
    }

    return "Please contact Global Nexus Capital Admin to claim this prize.";
  }

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">
        <div>
          <div className="eyebrow">Global Nexus Capital</div>
          <h1>My Raffle Prizes</h1>
          <p className="muted">
            Your complete raffle ticket prize history.
          </p>
        </div>

        <Link
          href="/lucky-cards"
          className="icon-button"
        >
          ←
        </Link>
      </header>

      {loading && (
        <section className="admin-card">
          <p className="muted">
            Loading your raffle prizes...
          </p>
        </section>
      )}

      {!loading && message && (
        <section className="admin-card">
          <p className="muted">
            {message}
          </p>
        </section>
      )}

      {!loading &&
        !message &&
        !prizes.length && (
          <section className="admin-card">
            <strong>No raffle prizes yet</strong>

            <p className="muted">
              Your raffle ticket prizes will appear here after you win.
            </p>
          </section>
        )}

      {!loading &&
        prizes.map((prize) => (

          <section
            className="admin-card"
            key={prize.id}
          >

            <div className="list-row">

              <div>
                <strong>
                  {prize.prize_name || "Mystery Prize"}
                </strong>

                <p className="muted">
                  {prizeValue(prize)}
                </p>
              </div>

              <span className="badge">
                {prize.prize_type}
              </span>

            </div>

            <p className="muted">
              🎟 Draw #{prize.draw_number}
            </p>

            {prize.event_name && (
              <p className="muted">
                Event: {prize.event_name}
              </p>
            )}

            <p className="muted">
              📅 Won: {formatDate(prize.created_at)}
            </p>

            <div className="form-card">

              <strong>
                {prize.fulfillment_status === "credited"
                  ? "✅ Credited"
                  : prize.fulfillment_status === "fulfilled"
                    ? "✅ Fulfilled"
                    : prize.fulfillment_status === "contacted"
                      ? "📞 Contacted"
                      : "⏳ Pending"}
              </strong>

              <p className="muted">
                {statusText(prize)}
              </p>

              {prize.fulfillment_note && (
                <p className="muted">
                  Admin note: {prize.fulfillment_note}
                </p>
              )}

            </div>

          </section>

        ))}

      <nav className="bottom-nav">

        <Link href="/">
          Home
        </Link>

        <Link href="/tasks">
          Task
        </Link>

        <Link href="/rank">
          Rank
        </Link>

        <Link href="/mine">
          Mine
        </Link>

      </nav>

    </main>
  );
}
