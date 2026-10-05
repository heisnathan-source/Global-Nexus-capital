"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Funds() {
  const [products, setProducts] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    fetch("/api/fund-products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch((e) => setStatus(e.message));
  }, []);

  function calculate(product) {
    const amount = Number(amounts[product.id]);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return null;
    }

    const rate = Number(product.interest_rate);

    if (!Number.isFinite(rate)) {
      return null;
    }

    const interest =
      Math.round(amount * rate) / 100;

    return {
      interest,
      maturity: amount + interest,
    };
  }

  async function buy(product) {
    setStatus("");

    const amount = Number(amounts[product.id]);
    const calc = calculate(product);

    if (!calc) {
      setStatus(
        `Enter a valid amount for ${product.name}.`
      );
      return;
    }

    if (
      Number(product.min_purchase) > 0 &&
      amount < Number(product.min_purchase)
    ) {
      setStatus(
        `The minimum amount for ${product.name} is GHS ${Number(
          product.min_purchase
        ).toLocaleString()}.`
      );
      return;
    }

    if (
      product.max_purchase != null &&
      amount > Number(product.max_purchase)
    ) {
      setStatus(
        `The maximum amount for ${product.name} is GHS ${Number(
          product.max_purchase
        ).toLocaleString()}.`
      );
      return;
    }

    if (
      !window.confirm(
        `Are you sure you wish to purchase ${product.name}?`
      )
    ) {
      return;
    }

    setBusy(product.id);

    try {
      const r = await fetch(
        "/api/fund-products",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            productId: product.id,
            amount,
          }),
        }
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.error || "Purchase failed."
        );
      }

      setStatus(
        `${product.name} purchased successfully.`
      );

      setAmounts((current) => ({
        ...current,
        [product.id]: "",
      }));
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mobile-shell scroll-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            Global Nexus Capital
          </div>

          <h1>Fund Products</h1>

          <p className="muted">
            Choose a fund and view its configured return
          </p>
        </div>

        <Link
          className="icon-button"
          href="/mine"
        >
          ←
        </Link>
      </header>

      {status && (
        <section className="admin-card">
          <p className="muted">{status}</p>
        </section>
      )}

      <section>
        {products.length === 0 ? (
          <div className="admin-card">
            <p className="muted">
              No active fund products are currently
              available.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {products.map((product) => {
              const calc = calculate(product);

              return (
                <article
                  className="admin-card"
                  key={product.id}
                >
                  {product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      style={{
                        width: "100%",
                        borderRadius: 16,
                        marginBottom: 12,
                        display: "block",
                      }}
                    />
                  )}

                  <div className="admin-card-head">
                    <div>
                      <strong>
                        {product.name}
                      </strong>

                      <p className="muted">
                        {product.interest_rate}% return
                        {" · "}
                        {product.period_days} days
                      </p>
                    </div>

                    <span className="badge">
                      {product.interest_rate}%
                    </span>
                  </div>

                  {product.description && (
                    <p className="muted">
                      {product.description}
                    </p>
                  )}

                  <div className="form-card">
                    <label>
                      Buy Amount
                      <input
                        inputMode="decimal"
                        value={
                          amounts[product.id] || ""
                        }
                        onChange={(e) =>
                          setAmounts((current) => ({
                            ...current,
                            [product.id]:
                              e.target.value,
                          }))
                        }
                        placeholder="Enter amount"
                      />
                    </label>

                    <div className="return-box">
                      <span>Interest</span>

                      <strong>
                        {calc
                          ? `GHS ${calc.interest.toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}`
                          : "—"}
                      </strong>
                    </div>

                    <div className="return-box">
                      <span>
                        Amount to receive at maturity
                      </span>

                      <strong>
                        {calc
                          ? `GHS ${calc.maturity.toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}`
                          : "—"}
                      </strong>
                    </div>

                    <p className="muted">
                      Allowed amount: GHS{" "}
                      {Number(
                        product.min_purchase
                      ).toLocaleString()}
                      {" – "}
                      {product.max_purchase == null
                        ? "no maximum"
                        : `GHS ${Number(
                            product.max_purchase
                          ).toLocaleString()}`}
                    </p>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        buy(product)
                      }
                      disabled={
                        busy === product.id ||
                        !calc
                      }
                    >
                      {busy === product.id
                        ? "Processing…"
                        : "PAY"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="admin-card">
        <strong>My Fund Purchases</strong>

        <div className="empty-document">
          <span>
            Active and matured fund records will
            appear here.
          </span>
        </div>
      </section>
    </main>
  );
}
