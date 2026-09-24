"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PointsCard() {

  const [data, setData] = useState({
    enabled: false,
    balance: 0,
    ledger: [],
    items: [],
    purchases: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [buyingId, setBuyingId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const [showCongratulations, setShowCongratulations] =
    useState(false);

  const [completedPurchase, setCompletedPurchase] =
    useState(null);

  const [showContactPrompt, setShowContactPrompt] =
    useState(false);


  async function load() {

    try {

      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/points",
        {
          credentials: "include",
          cache: "no-store"
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
          "Unable to load Points Card."
        );
      }

      setData({
        enabled: result.enabled === true,
        balance: result.balance || 0,
        ledger: result.ledger || [],
        items: result.items || [],
        purchases: result.purchases || []
      });

    } catch (e) {

      setError(
        e.message ||
        "Unable to load Points Card."
      );

    } finally {

      setLoading(false);

    }

  }


  useEffect(() => {
    load();
  }, []);


  function formatDate(date) {

    if (!date) return "";

    return new Date(
      date
    ).toLocaleString();

  }


  function openPurchase(item) {

    setError("");
    setSelectedItem(item);

  }


  function cancelPurchase() {

    setSelectedItem(null);

  }


  async function confirmPurchase() {

    if (!selectedItem) return;

    try {

      setBuyingId(selectedItem.id);
      setError("");

      const response = await fetch(
        "/api/points/purchase",
        {
          method: "POST",

          credentials: "include",

          headers: {
            "content-type":
              "application/json"
          },

          body: JSON.stringify({
            itemId: selectedItem.id
          })
        }
      );

      const result =
        await response.json();

      if (!response.ok) {

        throw new Error(
          result?.error ||
          "Unable to redeem this item."
        );

      }


      setCompletedPurchase(
        result.purchase
      );

      setSelectedItem(null);


      setData((current) => ({

        ...current,

        balance:
          result.balance,

        purchases: [
          result.purchase,
          ...(current.purchases || [])
        ],

        ledger: [
          {
            type: "redeem",
            points:
              Number(
                result.purchase
                  ?.points_spent || 0
              ),
            description:
              `Redeemed points for: ${
                result.purchase?.item_name ||
                "item"
              }`,
            created_at:
              result.purchase?.created_at ||
              new Date().toISOString()
          },

          ...(current.ledger || [])

        ]

      }));


      setShowCongratulations(true);


      setTimeout(() => {

        setShowCongratulations(false);

        setShowContactPrompt(true);

      }, 3500);


    } catch (e) {

      setError(
        e.message ||
        "Unable to redeem this item."
      );

    } finally {

      setBuyingId(null);

    }

  }


  if (loading) {

    return (

      <main className="mobile-shell scroll-page">

        <header className="topbar">

          <div>

            <div className="eyebrow">
              Global Nexus Capital
            </div>

            <h1>
              Points Card
            </h1>

            <p className="muted">
              Event points and rewards
            </p>

          </div>

          <Link
            className="icon-button"
            href="/mine"
          >
            ←
          </Link>

        </header>


        <section className="empty-document">

          <strong>
            Loading Points Card…
          </strong>

        </section>

      </main>

    );

  }


  if (!data.enabled) {

    return (

      <main className="mobile-shell scroll-page">

        <header className="topbar">

          <div>

            <div className="eyebrow">
              Global Nexus Capital
            </div>

            <h1>
              Points Card
            </h1>

            <p className="muted">
              Event points and rewards
            </p>

          </div>

          <Link
            className="icon-button"
            href="/mine"
          >
            ←
          </Link>

        </header>


        <section className="promo-placeholder">

          <strong>
            Points Card
          </strong>

          <p className="muted">

            This service is currently unavailable.

          </p>

        </section>


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


  return (

    <main className="mobile-shell scroll-page">


      <header className="topbar">

        <div>

          <div className="eyebrow">
            Global Nexus Capital
          </div>

          <h1>
            Points Card
          </h1>

          <p className="muted">

            Use your event points to redeem rewards.

          </p>

        </div>


        <Link
          className="icon-button"
          href="/mine"
        >
          ←
        </Link>

      </header>



      {/* =============================== */}
      {/* POINTS BALANCE */}
      {/* =============================== */}

      <section className="balance-card">

        <span>
          Points Balance
        </span>

        <strong>

          {Number(
            data.balance || 0
          ).toLocaleString()}

        </strong>


        <p className="muted">

          Points are reward credits and are not
          automatically converted to cash.

        </p>

      </section>



      {/* =============================== */}
      {/* UNLIMITED POINTS SHOP */}
      {/* =============================== */}

      {data.items.length > 0 && (

        <section className="admin-card">

          <div className="admin-card-head">

            <strong>
              Points Shop
            </strong>

            <span className="badge">

              {data.items.length}

            </span>

          </div>


          <p className="muted">

            Redeem your available points for rewards.

          </p>


          <div className="points-shop-grid">

            {data.items.map((item) => (

              <button
                type="button"
                className="points-shop-item"
                key={item.id}
                onClick={() =>
                  openPurchase(item)
                }
              >


                {item.image_url ? (

                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="points-shop-image"
                  />

                ) : (

                  <div className="points-shop-no-image">

                    🎁

                  </div>

                )}


                <strong>

                  {item.name}

                </strong>


                {item.description && (

                  <span className="muted">

                    {item.description}

                  </span>

                )}


                <span className="points-shop-price">

                  {Number(
                    item.points_required || 0
                  ).toLocaleString()} pts

                </span>

              </button>

            ))}

          </div>

        </section>

      )}



      {/* =============================== */}
      {/* PURCHASE HISTORY */}
      {/* =============================== */}

      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            My Purchased Items
          </strong>

          <span className="badge">

            {data.purchases.length}

          </span>

        </div>


        {data.purchases.length ? (

          data.purchases.map((purchase) => (

            <div
              className="form-card"
              key={purchase.id}
            >


              <div className="list-row">

                <div>

                  <strong>

                    🎁 {purchase.item_name}

                  </strong>


                  {purchase.item_description && (

                    <span className="muted">

                      {purchase.item_description}

                    </span>

                  )}

                </div>


                <span className="badge">

                  {purchase.fulfillment_status ||
                    "pending"}

                </span>

              </div>


              <p className="muted">

                Points spent:{" "}

                {Number(
                  purchase.points_spent || 0
                ).toLocaleString()}

              </p>


              <p className="muted">

                Purchased:{" "}

                {formatDate(
                  purchase.created_at
                )}

              </p>


              {purchase.fulfillment_note && (

                <p className="muted">

                  Admin note:{" "}

                  {purchase.fulfillment_note}

                </p>

              )}


              {purchase.fulfilled_at && (

                <p className="muted">

                  Fulfilled:{" "}

                  {formatDate(
                    purchase.fulfilled_at
                  )}

                </p>

              )}

            </div>

          ))

        ) : (

          <div className="empty-document">

            <strong>
              No purchased items yet
            </strong>

            <p className="muted">

              Items you redeem with your points
              will be permanently recorded here.

            </p>

          </div>

        )}

      </section>



      {/* =============================== */}
      {/* POINTS HISTORY */}
      {/* =============================== */}

      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Points History
          </strong>

        </div>


        {data.ledger.length ? (

          data.ledger.map(
            (item, index) => {

              const points =
                Number(
                  item.points || 0
                );

              const isRedeem =
                item.type === "redeem";

              const displayPoints =
                isRedeem
                  ? -Math.abs(points)
                  : points;

              return (

                <div
                  className="list-row"
                  key={`${item.created_at}-${index}`}
                >

                  <div>

                    <strong>

                      {item.type}

                    </strong>


                    <span className="muted">

                      {item.description ||
                        "Points transaction"}

                    </span>

                  </div>


                  <span className="badge">

                    {displayPoints > 0
                      ? "+"
                      : ""}

                    {displayPoints.toLocaleString()}

                  </span>

                </div>

              );

            }

          )

        ) : (

          <p className="muted">

            No points transactions yet.

          </p>

        )}

      </section>



      {error && (

        <p className="auth-error">

          {error}

        </p>

      )}



      {/* =============================== */}
      {/* PURCHASE CONFIRMATION */}
      {/* =============================== */}

      {selectedItem && (

        <div className="points-modal-backdrop">

          <section className="points-modal">


            <h2>
              Redeem Item?
            </h2>


            <p>

              You are about to redeem:

            </p>


            <strong>

              {selectedItem.name}

            </strong>


            <p className="muted">

              Cost:{" "}

              {Number(
                selectedItem.points_required || 0
              ).toLocaleString()} points

            </p>


            <p className="muted">

              Your available balance:{" "}

              {Number(
                data.balance || 0
              ).toLocaleString()} points

            </p>


            <div className="points-modal-actions">


              <button
                type="button"
                className="secondary-button"
                onClick={cancelPurchase}
                disabled={!!buyingId}
              >

                Cancel

              </button>


              <button
                type="button"
                className="primary-button"
                onClick={confirmPurchase}
                disabled={
                  !!buyingId
                }
              >

                {buyingId
                  ? "Redeeming..."
                  : "Confirm"}

              </button>

            </div>

          </section>

        </div>

      )}



      {/* =============================== */}
      {/* CONGRATULATIONS ANIMATION */}
      {/* =============================== */}

      {showCongratulations && (

        <div className="points-celebration">

          <div className="points-celebration-box">

            <div className="points-confetti">

              🎉 🎊 ✨ 🎁 ✨ 🎊 🎉

            </div>


            <h1>
              Congratulations!
            </h1>


            <p>

              You successfully redeemed:

            </p>


            <strong>

              {completedPurchase?.item_name}

            </strong>


            <p className="muted">

              Your points have been deducted
              successfully.

            </p>

          </div>

        </div>

      )}



      {/* =============================== */}
      {/* CONTACT ADMIN PROMPT */}
      {/* =============================== */}

      {showContactPrompt && (

        <div className="points-modal-backdrop">

          <section className="points-modal">


            <h2>
              Redemption Successful 🎉
            </h2>


            <p>

              Your item has been recorded
              successfully.

            </p>


            <p className="muted">

              Please contact Global Nexus Capital administration
              to arrange how your purchased item
              will be received.

            </p>


            <button
              type="button"
              className="primary-button"
              onClick={() => {

                setShowContactPrompt(false);

              }}
            >

              Okay

            </button>

          </section>

        </div>

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
