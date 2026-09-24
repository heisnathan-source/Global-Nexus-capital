"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PointsCardsAdmin() {

  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  async function load() {

    try {

      setLoading(true);
      setError("");

      const response =
        await fetch(
          "/api/admin/points",
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
          "Unable to load Points Cards."
        );

      }

      setItems(
        result.items || []
      );

      setPurchases(
        result.purchases || []
      );

    } catch (e) {

      setError(
        e.message ||
        "Unable to load Points Cards."
      );

    } finally {

      setLoading(false);

    }

  }


  useEffect(() => {

    load();

  }, []);


  const activeItems =
    items.filter(
      (item) =>
        item.active === true
    );


  const hiddenItems =
    items.filter(
      (item) =>
        item.active !== true
    );


  const pendingPurchases =
    purchases.filter(
      (purchase) =>
        purchase.fulfillment_status ===
        "pending"
    );


  const fulfilledPurchases =
    purchases.filter(
      (purchase) =>
        purchase.fulfillment_status ===
        "fulfilled"
    );


  if (loading) {

    return (

      <main className="mobile-shell scroll-page">

        <section className="empty-document">

          <strong>
            Loading Points Cards…
          </strong>

        </section>

      </main>

    );

  }


  return (

    <main className="mobile-shell scroll-page">


      <header className="topbar">

        <div>

          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Points Cards
          </h1>

          <p className="muted">

            Manage the Points Shop and
            user reward redemptions.

          </p>

        </div>


        <Link
          className="icon-button"
          href="/admin"
        >
          ←
        </Link>

      </header>



      {/* ============================== */}
      {/* MAIN ACTION */}
      {/* ============================== */}

      <Link
        className="primary-button"
        href="/admin/points"
      >

        Manage Points Shop

      </Link>



      {/* ============================== */}
      {/* STATISTICS */}
      {/* ============================== */}

      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Points Shop Overview
          </strong>

        </div>


        <div className="points-overview-grid">


          <div className="points-overview-box">

            <span>
              Total Items
            </span>

            <strong>
              {items.length}
            </strong>

          </div>


          <div className="points-overview-box">

            <span>
              Active Items
            </span>

            <strong>
              {activeItems.length}
            </strong>

          </div>


          <div className="points-overview-box">

            <span>
              Hidden Items
            </span>

            <strong>
              {hiddenItems.length}
            </strong>

          </div>


          <div className="points-overview-box">

            <span>
              Total Redemptions
            </span>

            <strong>
              {purchases.length}
            </strong>

          </div>


          <div className="points-overview-box">

            <span>
              Pending
            </span>

            <strong>
              {pendingPurchases.length}
            </strong>

          </div>


          <div className="points-overview-box">

            <span>
              Fulfilled
            </span>

            <strong>
              {fulfilledPurchases.length}
            </strong>

          </div>


        </div>

      </section>



      {/* ============================== */}
      {/* QUICK INFORMATION */}
      {/* ============================== */}

      <section className="admin-card">

        <strong>
          How Points Cards Work
        </strong>


        <p className="muted">

          Users receive points through
          Global Nexus Capital events and approved rewards.

        </p>


        <p className="muted">

          Points are used to redeem items
          published in the Points Shop.

        </p>


        <p className="muted">

          Redeemed points are not converted
          automatically into cash.

        </p>


        <p className="muted">

          Every redemption is permanently
          recorded and can be managed from
          the Points Shop.

        </p>

      </section>



      {/* ============================== */}
      {/* RECENT REDEMPTIONS */}
      {/* ============================== */}

      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Recent Redemptions
          </strong>


          <Link
            className="small-button"
            href="/admin/points"
          >

            View All

          </Link>

        </div>


        {purchases.length ? (

          purchases
            .slice(0, 5)
            .map((purchase) => (

              <div
                className="list-row"
                key={purchase.id}
              >

                <div>

                  <strong>

                    {purchase.item_name}

                  </strong>


                  <span className="muted">

                    {purchase.user_name ||
                      "Unknown user"}

                  </span>

                </div>


                <span className="badge">

                  {purchase.fulfillment_status ||
                    "pending"}

                </span>

              </div>

            ))

        ) : (

          <div className="empty-document">

            <strong>
              No redemptions yet
            </strong>

            <p className="muted">

              User reward redemptions will
              appear here.

            </p>

          </div>

        )}

      </section>



      {/* ============================== */}
      {/* ERROR */}
      {/* ============================== */}

      {error && (

        <p className="auth-error">

          {error}

        </p>

      )}


    </main>

  );

}
