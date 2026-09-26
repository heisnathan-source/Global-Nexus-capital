"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BOXES = [1, 2, 3, 4, 5, 6];

export default function LuckyCards() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [state, setState] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const [drawing, setDrawing] = useState(false);
  const [animatingBox, setAnimatingBox] = useState(null);
  const [winningBox, setWinningBox] = useState(null);
  const [revealedPrize, setRevealedPrize] = useState(null);
  const [status, setStatus] = useState("");

  async function loadEvents() {
    try {
      const response = await fetch("/api/lucky-cards", {
        credentials: "include",
        cache: "no-store"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load Lucky Cards."
        );
      }

      setEnabled(data.enabled === true);
      setEvents(data.events || []);

      if (!eventId && data.events?.[0]) {
        setEventId(String(data.events[0].id));
      }
    } catch (error) {
      setStatus(
        error.message || "Unable to load Lucky Cards."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadState(id) {
    if (!id) return;

    try {
      const response = await fetch(
        `/api/lucky-cards?eventId=${encodeURIComponent(id)}`,
        {
          credentials: "include",
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (response.ok) {
        setState(data);
      }
    } catch {
      // Safe refresh failure.
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (eventId) {
      loadState(eventId);
      setWinningBox(null);
      setRevealedPrize(null);
      setStatus("");
    }
  }, [eventId]);

  async function drawLuckyCard() {
    if (
      !eventId ||
      drawing ||
      !state?.canDraw
    ) {
      return;
    }

    setDrawing(true);
    setStatus("");
    setWinningBox(null);
    setRevealedPrize(null);

    let animationStep = 0;

    const animation = setInterval(() => {
      setAnimatingBox(
        BOXES[animationStep % BOXES.length]
      );

      animationStep += 1;
    }, 180);

    try {
      const response = await fetch(
        "/api/lucky-cards",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            eventId
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Draw unavailable."
        );
      }

      /*
       * The backend decides the prize and
       * returns the admin-configured box position.
       */
      const selectedBox = Number(
        data.boxPosition || 1
      );

      setTimeout(() => {
        clearInterval(animation);

        setAnimatingBox(null);
        setWinningBox(selectedBox);

        setTimeout(() => {
          setRevealedPrize(
            data.prize || null
          );

          setStatus(
            data.prize?.prize_name
              ? `Congratulations! You received ${data.prize.prize_name}`
              : "Congratulations! Your prize has been revealed."
          );
        }, 700);
      }, 900);

      await loadState(eventId);

    } catch (error) {
      clearInterval(animation);

      setAnimatingBox(null);

      setStatus(
        error.message || "Draw unavailable."
      );

    } finally {
      setTimeout(() => {
        setDrawing(false);
      }, 1700);
    }
  }

  const selectedEvent = events.find(
    (event) =>
      String(event.id) === String(eventId)
  );

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">
        <div>
          <div className="eyebrow">
            Global Nexus Capital
          </div>

          <h1>
            Raffle Tickets
          </h1>

          <p className="muted">
            Choose a mystery box and discover your reward
          </p>
        </div>

        <Link
          className="icon-button"
          href="/mine"
        >
          ←
        </Link>
      </header>

      {loading ? (

        <section className="empty-document">
          <strong>
            Loading Raffle Tickets…
          </strong>
        </section>

      ) : !enabled ? (

        <section className="promo-placeholder">
          <strong>
            Raffle Tickets
          </strong>

          <p className="muted">
            This service is currently unavailable.
          </p>
        </section>

      ) : !events.length ? (

        <section className="promo-placeholder">
          <strong>
            Raffle Ticket Event
          </strong>

          <p className="muted">
            No active event is currently available.
          </p>
        </section>

      ) : (

        <>
          <section className="promo-placeholder">

            <label>
              Active Event

              <select
                value={eventId}
                disabled={drawing}
                onChange={(e) => {
                  setEventId(e.target.value);
                }}
              >
                {events.map((event) => (
                  <option
                    key={event.id}
                    value={event.id}
                  >
                    {event.name}
                  </option>
                ))}
              </select>
            </label>

            <strong>
              {selectedEvent?.name}
            </strong>

            {selectedEvent?.description && (
              <p className="muted">
                {selectedEvent.description}
              </p>
            )}

          </section>

          <section className="admin-card">

            <div className="admin-card-head">
              <strong>
                🎁 Raffle Mystery Boxes
              </strong>
            </div>

            <div className="lucky-card-balance">

              <strong>
                Available Raffle Tickets
              </strong>

              <span className="badge">
                {state?.availableDraws || 0}
              </span>

            </div>

            <p className="muted">
              Each ticket reveals one mystery reward.
            </p>

            <div className="lucky-box-grid">

              {BOXES.map((box) => {
                const isAnimating =
                  animatingBox === box;

                const isWinner =
                  winningBox === box;

                return (
                  <button
                    key={box}
                    type="button"
                    disabled={
                      drawing ||
                      !state?.canDraw
                    }
                    className={[
                      "lucky-mystery-box",
                      isAnimating
                        ? "is-shuffling"
                        : "",
                      isWinner
                        ? "is-winning"
                        : "",
                      isWinner && revealedPrize
                        ? "is-revealed"
                        : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={drawLuckyCard}
                  >

                    {isWinner &&
                    revealedPrize ? (

                      <div className="lucky-prize-reveal">

                        <span className="lucky-reveal-icon">
                          🎉
                        </span>

                        <strong>
                          {revealedPrize.prize_name ||
                            "Prize"}
                        </strong>

                        <span className="lucky-prize-value">
                          {revealedPrize.prize_type === "cash"
                            ? `GH₵${Number(revealedPrize.prize_amount || 0).toLocaleString()}`
                            : revealedPrize.prize_type === "points"
                              ? `${Number(revealedPrize.prize_amount || 0).toLocaleString()} Points`
                              : "📩 Contact the administrator to claim your prize."}
                        </span>

                      </div>

                    ) : (

                      <>
                        <span className="lucky-box-icon">
                          🎁
                        </span>

                        <span>
                          Mystery Box {box}
                        </span>
                      </>

                    )}

                  </button>
                );
              })}

            </div>

            <button
              className="primary-button"
              type="button"
              disabled={
                drawing ||
                !state?.canDraw
              }
              onClick={drawLuckyCard}
            >
              {drawing
                ? "Choosing a mystery box…"
                : state?.canDraw
                  ? "DRAW RAFFLE TICKET"
                  : "NO TICKETS AVAILABLE"}
            </button>

            {!state?.canDraw && (
              <p className="muted">
                You do not currently have an available raffle ticket.
              </p>
            )}

            {revealedPrize && (
              <section className="lucky-result-card">

                <div>
                  🎊 Congratulations!
                </div>

                <strong>
                  {revealedPrize.prize_name ||
                    "Mystery Prize"}
                </strong>

                <div className="lucky-prize-value">
                  {revealedPrize.prize_type === "cash"
                    ? `GH₵${Number(revealedPrize.prize_amount || 0).toLocaleString()}`
                    : revealedPrize.prize_type === "points"
                      ? `${Number(revealedPrize.prize_amount || 0).toLocaleString()} Points`
                      : "📩 Please contact the administrator to claim your prize."}
                </div>

              </section>
            )}

            {status && (
              <p className="muted">
                {status}
              </p>
            )}

            <Link
              href="/lucky-prizes"
              className="secondary-button"
            >
              🎁 VIEW MY PRIZE HISTORY
            </Link>

          </section>

        </>

      )}

      <nav className="bottom-nav">

        <Link href="/">
          Home
        </Link>

        <Link href="/tasks">
          Task
        </Link>

        <Link href="/message">
          Message
        </Link>

        <Link href="/rank">
          Rank
        </Link>

        <Link
          href="/mine"
          className="active"
        >
          Mine
        </Link>

      </nav>

    </main>
  );
}
