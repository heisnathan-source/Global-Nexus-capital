"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PaymentFlow() {
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(
        "cmc_deposit_order"
      );

      if (saved) {
        setOrder(JSON.parse(saved));
      }
    } catch {
      setOrder(null);
    }
  }, []);

  async function copyNumber() {
    const number = order?.accountNumber;

    if (!number) return;

    try {
      await navigator.clipboard.writeText(number);
      setCopied("Copied");

      setTimeout(() => {
        setCopied("");
      }, 1500);
    } catch {
      setCopied("");
    }
  }

  async function madePayment() {
    const orderId = order?.order?.id;

    if (!orderId) {
      setError(
        "No active deposit order was found."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const r = await fetch("/api/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "submit",
          orderId
        })
      });

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.error ||
          "Unable to submit payment."
        );
      }

      const updated = {
        ...order,
        order: d.order
      };

      sessionStorage.setItem(
        "cmc_deposit_order",
        JSON.stringify(updated)
      );

      setOrder(updated);

      router.push(
        "/deposit/verification"
      );
    } catch (e) {
      setError(
        e?.message ||
        "Unable to submit payment."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!order?.order?.id) {
    return (
      <section className="empty-document">
        <strong>
          No active payment
        </strong>

        <p className="muted">
          Start a deposit first.
        </p>

        <button
          type="button"
          className="primary-button"
          onClick={() =>
            router.push("/deposit")
          }
        >
          Back to Deposit
        </button>
      </section>
    );
  }

  const amount = Number(
    order.order.amount || 0
  );

  return (
    <>
      <section className="balance-card">
        <span>Deposit Amount</span>

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

        <div className="account-meta">
          <span>Your Network</span>
          <span>
            {order.network || "—"}
          </span>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>
            Assigned Payment Account
          </strong>

          <span className="badge">
            Assigned
          </span>
        </div>

        <div className="payment-details">
          <div>
            <span>Recipient Name</span>
            <strong>
              {order.recipientName || "—"}
            </strong>
          </div>

          <div>
            <span>
              Payment Number
            </span>

            <strong>
              {order.accountNumber || "—"}
            </strong>

            <button
              type="button"
              className="small-button"
              onClick={copyNumber}
              disabled={!order.accountNumber}
            >
              {copied || "Copy"}
            </button>
          </div>

          <div>
            <span>Payment Network</span>
            <strong>
              {order.paymentNetwork ||
                order.network ||
                "—"}
            </strong>
          </div>
        </div>

        <p className="muted">
          Send exactly the deposit amount
          shown above to the assigned payment
          number. Do not choose another payment
          number.
        </p>
      </section>

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      <button
        type="button"
        className="primary-button"
        onClick={madePayment}
        disabled={busy}
      >
        {busy
          ? "Submitting..."
          : "I Have Made Payment"}
      </button>
    </>
  );
}
