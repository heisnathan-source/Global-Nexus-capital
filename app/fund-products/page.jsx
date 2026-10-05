"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "GHS 0.00";
  }

  return `GHS ${number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isMatured(purchase) {
  return String(purchase.status || "").toLowerCase() === "matured";
}

export default function Funds() {
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(null);
  const [loadingPurchases, setLoadingPurchases] = useState(true);

  async function loadFunds() {
    try {
      setLoadingPurchases(true);

      const response = await fetch(
        "/api/fund-products",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load fund products."
        );
      }

      setProducts(data.products || []);
      setPurchases(data.purchases || []);
    } catch (error) {
      setStatus(
        error.message ||
          "Unable to load fund products."
      );
    } finally {
      setLoadingPurchases(false);
    }
  }

  useEffect(() => {
    loadFunds();
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
      const response = await fetch(
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Purchase failed."
        );
      }

      setStatus(
        `${product.name} purchased successfully.`
      );

      setAmounts((current) => ({
        ...current,
        [product.id]: "",
      }));

      // Refresh products and purchases so the
      // newly purchased fund appears immediately.
      await loadFunds();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(null);
    }
  }

  const activePurchases = purchases.filter(
    (purchase) => !isMatured(purchase)
  );

  const maturedPurchases = purchases.filter(
    (purchase) => isMatured(purchase)
  );

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
                        onChange={(event) =>
                          setAmounts((current) => ({
                            ...current,
                            [product.id]:
                              event.target.value,
                          }))
                        }
                        placeholder="Enter amount"
                      />
                    </label>

                    <div className="return-box">
                      <span>Interest</span>

                      <strong>
                        {calc
                          ? formatMoney(
                              calc.interest
                            )
                          : "—"}
                      </strong>
                    </div>

                    <div className="return-box">
                      <span>
                        Amount to receive at maturity
                      </span>

                      <strong>
                        {calc
                          ? formatMoney(
                              calc.maturity
                            )
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
        <div className="admin-card-head">
          <strong>My Fund Purchases</strong>

          {purchases.length > 0 && (
            <span className="badge">
              {purchases.length}{" "}
              {purchases.length === 1
                ? "purchase"
                : "purchases"}
            </span>
          )}
        </div>

        {loadingPurchases ? (
          <div className="empty-document">
            <span>
              Loading your fund purchases…
            </span>
          </div>
        ) : purchases.length === 0 ? (
          <div className="empty-document">
            <span>
              You have no fund purchases yet.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {activePurchases.length > 0 && (
              <div>
                <h2
                  style={{
                    marginBottom: 12,
                  }}
                >
                  Active Funds
                </h2>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {activePurchases.map(
                    (purchase) => (
                      <article
                        key={purchase.id}
                        className="form-card"
                      >
                        {purchase.image_url && (
                          <img
                            src={purchase.image_url}
                            alt={purchase.fund_name}
                            style={{
                              width: "100%",
                              borderRadius: 14,
                              marginBottom: 12,
                              display: "block",
                            }}
                          />
                        )}

                        <div className="admin-card-head">
                          <div>
                            <strong>
                              {purchase.fund_name}
                            </strong>

                            <p className="muted">
                              {purchase.interest_rate}%
                              {" · "}
                              {purchase.period_days} days
                            </p>
                          </div>

                          <span className="badge">
                            ACTIVE
                          </span>
                        </div>

                        <div className="return-box">
                          <span>Amount invested</span>
                          <strong>
                            {formatMoney(
                              purchase.purchase_amount
                            )}
                          </strong>
                        </div>

                        <div className="return-box">
                          <span>Interest</span>
                          <strong>
                            {formatMoney(
                              Number(
                                purchase.expected_return
                              ) -
                                Number(
                                  purchase.purchase_amount
                                )
                            )}
                          </strong>
                        </div>

                        <div className="return-box">
                          <span>
                            Amount at maturity
                          </span>
                          <strong>
                            {formatMoney(
                              purchase.expected_return
                            )}
                          </strong>
                        </div>

                        <p className="muted">
                          Matures:{" "}
                          {formatDate(
                            purchase.maturity_at
                          )}
                        </p>
                      </article>
                    )
                  )}
                </div>
              </div>
            )}

            {maturedPurchases.length > 0 && (
              <div>
                <h2
                  style={{
                    marginBottom: 12,
                    marginTop:
                      activePurchases.length > 0
                        ? 24
                        : 0,
                  }}
                >
                  Matured Funds
                </h2>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {maturedPurchases.map(
                    (purchase) => (
                      <article
                        key={purchase.id}
                        className="form-card"
                      >
                        {purchase.image_url && (
                          <img
                            src={purchase.image_url}
                            alt={purchase.fund_name}
                            style={{
                              width: "100%",
                              borderRadius: 14,
                              marginBottom: 12,
                              display: "block",
                            }}
                          />
                        )}

                        <div className="admin-card-head">
                          <div>
                            <strong>
                              {purchase.fund_name}
                            </strong>

                            <p className="muted">
                              {purchase.interest_rate}%
                              {" · "}
                              {purchase.period_days} days
                            </p>
                          </div>

                          <span className="badge">
                            MATURED
                          </span>
                        </div>

                        <div className="return-box">
                          <span>Amount invested</span>
                          <strong>
                            {formatMoney(
                              purchase.purchase_amount
                            )}
                          </strong>
                        </div>

                        <div className="return-box">
                          <span>Interest earned</span>
                          <strong>
                            {formatMoney(
                              Number(
                                purchase.expected_return
                              ) -
                                Number(
                                  purchase.purchase_amount
                                )
                            )}
                          </strong>
                        </div>

                        <div className="return-box">
                          <span>
                            Maturity amount
                          </span>
                          <strong>
                            {formatMoney(
                              purchase.expected_return
                            )}
                          </strong>
                        </div>

                        <p className="muted">
                          Matured:{" "}
                          {formatDate(
                            purchase.maturity_at
                          )}
                        </p>
                      </article>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
