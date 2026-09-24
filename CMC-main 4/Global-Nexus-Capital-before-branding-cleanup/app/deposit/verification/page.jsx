"use client";

import { useEffect, useState } from "react";

export default function DepositVerification() {
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState("Pending");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(
        "cmc_deposit_order"
      );

      if (saved) {
        const parsed = JSON.parse(saved);

        setOrder(parsed);

        const savedStatus = parsed?.order?.status;

        setStatus(
          savedStatus === "verified"
            ? "Successful"
            : savedStatus === "rejected"
            ? "Rejected"
            : "Pending"
        );
      }
    } catch {
      setOrder(null);
    }
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;

    const timer = setInterval(() => {
      setSeconds((current) =>
        Math.max(0, current - 1)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds]);

  async function refresh() {
    if (
      seconds > 0 ||
      !order?.order?.id ||
      checking
    ) {
      return;
    }

    setChecking(true);
    setSeconds(120);
    setError("");

    try {
      const r = await fetch(
        `/api/deposit?orderId=${encodeURIComponent(
          order.order.id
        )}`
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.error ||
          "Unable to check payment status."
        );
      }

      const updated = {
        ...order,
        order: {
          ...order.order,
          ...d.order
        }
      };

      setOrder(updated);

      sessionStorage.setItem(
        "cmc_deposit_order",
        JSON.stringify(updated)
      );

      setStatus(
        d.order.status === "verified"
          ? "Successful"
          : d.order.status === "rejected"
          ? "Rejected"
          : "Pending"
      );
    } catch (e) {
      setError(
        e?.message ||
        "Unable to check payment status."
      );
    } finally {
      setChecking(false);
    }
  }

  function goHome() {
    sessionStorage.removeItem("cmc_deposit_order");
    window.location.href = "/";
  }

  const amount = Number(
    order?.order?.amount || 0
  );

  const isSuccessful =
    status === "Successful";

  const isRejected =
    status === "Rejected";

  return (
    <main className="mobile-shell scroll-page verification-page">

      <div className="firefly firefly-1" />
      <div className="firefly firefly-2" />
      <div className="firefly firefly-3" />
      <div className="firefly firefly-4" />
      <div className="firefly firefly-5" />
      <div className="firefly firefly-6" />
      <div className="firefly firefly-7" />
      <div className="firefly firefly-8" />

      <header className="topbar verification-topbar">
        <div>
          <div className="eyebrow">
            Global Nexus Capital
          </div>

          <h1>
            Payment Verification
          </h1>

          <p className="muted">
            {isSuccessful
              ? "Your payment has been confirmed"
              : isRejected
              ? "Your payment was not approved"
              : "Waiting for Admin confirmation"}
          </p>
        </div>
      </header>

      <section
        className={`verification-status-card ${
          isSuccessful
            ? "verification-success"
            : isRejected
            ? "verification-rejected"
            : "verification-pending"
        }`}
      >
        <div className="verification-status-icon">
          {isSuccessful
            ? "✓"
            : isRejected
            ? "!"
            : "◌"}
        </div>

        <span>
          Verification Status
        </span>

        <strong>
          {status}
        </strong>

        {!isSuccessful && !isRejected && (
          <p>
            Your payment is waiting for confirmation.
          </p>
        )}

        {isSuccessful && (
          <p>
            Your deposit has been successfully confirmed
            and credited to your Global Nexus Capital account.
          </p>
        )}

        {isRejected && (
          <p>
            Your payment was not approved.
          </p>
        )}
      </section>

      {order?.order?.id && (
        <section className="verification-order-card">
          <div>
            <span>
              Deposit Amount
            </span>

            <strong>
              GHS{" "}
              {amount.toLocaleString(
                "en-GH",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }
              )}
            </strong>
          </div>

          <div>
            <span>
              Deposit Order
            </span>

            <strong className="verification-order-id">
              #{order.order.id}
            </strong>
          </div>
        </section>
      )}

      {!isSuccessful && !isRejected && (
        <section className="waiting-card">
          <div className="waiting-dots">
            <span />
            <span />
            <span />
          </div>

          <strong>
            Please wait patiently
          </strong>

          <p>
            Your deposit order remains safely active
            while waiting for confirmation.
          </p>
        </section>
      )}

      {isSuccessful && (
        <section className="verification-complete-message">
          <strong>
            Payment Successful
          </strong>

          <p>
            Your deposit has been added to your Global Nexus Capital account.
          </p>
        </section>
      )}

      {isRejected && (
        <section className="verification-rejection-message">
          <strong>
            Payment Not Approved
          </strong>

          <p>
            Please contact support if you need assistance.
          </p>
        </section>
      )}

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      {!isSuccessful && !isRejected && (
        <>
          <p className="verification-refresh-note">
            You can check the latest verification status
            once every 2 minutes.
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={refresh}
            disabled={
              seconds > 0 ||
              !order?.order?.id ||
              checking
            }
          >
            {checking
              ? "Checking..."
              : seconds > 0
              ? `Check again in ${seconds}s`
              : "Check Payment Status"}
          </button>
        </>
      )}

      {isSuccessful && (
        <div className="verification-home-button">
          <button
            type="button"
            className="primary-button"
            onClick={goHome}
          >
            Back to Homepage
          </button>
        </div>
      )}

    </main>
  );
}
