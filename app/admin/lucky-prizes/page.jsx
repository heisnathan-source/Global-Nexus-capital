"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminLuckyPrizesPage() {
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState(null);

  async function loadPrizes() {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        "/api/admin/lucky-prizes",
        {
          credentials: "include",
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to load Lucky Prize records."
        );
      }

      setPrizes(data.prizes || []);

    } catch (error) {
      setMessage(
        error.message ||
        "Unable to load Lucky Prize records."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrizes();
  }, []);

  function formatDate(date) {
    if (!date) return "";

    return new Date(date).toLocaleString();
  }

  function formatAmount(amount) {
    return Number(amount || 0).toLocaleString(
      undefined,
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    );
  }

  function prizeValue(prize) {
    if (prize.prize_type === "cash") {
      return `GH₵${formatAmount(prize.prize_amount)}`;
    }

    if (prize.prize_type === "points") {
      return `${formatAmount(
        prize.prize_amount
      )} Points`;
    }

    return "Physical Gift";
  }

  function updateLocalPrize(id, field, value) {
    setPrizes((current) =>
      current.map((prize) =>
        prize.id === id
          ? {
              ...prize,
              [field]: value
            }
          : prize
      )
    );
  }

  async function savePrize(prize) {
    try {
      setSavingId(prize.id);
      setMessage("");

      const response = await fetch(
        "/api/admin/lucky-prizes",
        {
          method: "PATCH",

          credentials: "include",

          headers: {
            "content-type":
              "application/json"
          },

          body: JSON.stringify({
            id: prize.id,
            fulfillmentStatus:
              prize.fulfillment_status,
            fulfillmentNote:
              prize.fulfillment_note || ""
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to update prize record."
        );
      }

      setMessage(
        "Prize record updated successfully."
      );

      await loadPrizes();

    } catch (error) {
      setMessage(
        error.message ||
        "Unable to update prize record."
      );
    } finally {
      setSavingId(null);
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
            Lucky Prize Records
          </h1>

          <p className="muted">
            Complete record of all prizes won from Raffle Tickets.
          </p>

        </div>

        <Link
          href="/admin/lucky-cards"
          className="icon-button"
        >
          ←
        </Link>

      </header>


      {message && (

        <section className="admin-card">

          <p className="muted">
            {message}
          </p>

        </section>

      )}


      <section className="admin-card">

        <div className="list-row">

          <strong>
            All Prize Records
          </strong>

          <button
            type="button"
            className="secondary-button"
            onClick={loadPrizes}
            disabled={loading}
          >
            Refresh
          </button>

        </div>


        {loading && (

          <p className="muted">
            Loading prize records...
          </p>

        )}


        {!loading && !prizes.length && (

          <p className="muted">
            No Raffle Ticket prizes have been won yet.
          </p>

        )}


        {!loading && prizes.map((prize) => (

          <div
            className="form-card"
            key={prize.id}
          >

            <div className="list-row">

              <strong>
                🎁 {prize.prize_name || "Mystery Prize"}
              </strong>

              <span className="badge">
                {prize.prize_type}
              </span>

            </div>


            <p className="muted">
              Value: {prizeValue(prize)}
            </p>


            <p className="muted">
              👤 User:{" "}
              {prize.username ||
                prize.email ||
                "Unknown user"}
            </p>


            {prize.email && prize.username && (

              <p className="muted">
                Email: {prize.email}
              </p>

            )}


            <p className="muted">
              🎟 Draw #{prize.draw_number}
            </p>


            {prize.event_name && (

              <p className="muted">
                Event: {prize.event_name}
              </p>

            )}


            <p className="muted">
              📅 Won:{" "}
              {formatDate(prize.created_at)}
            </p>


            <label>

              Fulfillment status

              <select
                value={
                  prize.fulfillment_status ||
                  "pending"
                }
                onChange={(e) =>
                  updateLocalPrize(
                    prize.id,
                    "fulfillment_status",
                    e.target.value
                  )
                }
              >

                <option value="pending">
                  Pending
                </option>

                <option value="contacted">
                  Contacted User
                </option>

                <option value="fulfilled">
                  Fulfilled
                </option>

                <option value="credited">
                  Credited
                </option>

              </select>

            </label>


            <label>

              Admin note

              <textarea
                value={
                  prize.fulfillment_note || ""
                }
                placeholder="Add information about this prize..."
                onChange={(e) =>
                  updateLocalPrize(
                    prize.id,
                    "fulfillment_note",
                    e.target.value
                  )
                }
              />

            </label>


            {prize.fulfilled_at && (

              <p className="muted">
                Fulfilled:{" "}
                {formatDate(
                  prize.fulfilled_at
                )}
              </p>

            )}


            <button
              type="button"
              className="primary-button"
              disabled={
                savingId === prize.id
              }
              onClick={() =>
                savePrize(prize)
              }
            >
              {
                savingId === prize.id
                  ? "Saving..."
                  : "Save Prize Record"
              }
            </button>

          </div>

        ))}

      </section>

    </main>
  );
}
