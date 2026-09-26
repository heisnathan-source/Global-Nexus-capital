"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DepositFlow() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const text = String(amount).trim();

  const valid =
    /^\d+(\.\d{1,2})?$/.test(text) &&
    Number(text) > 0 &&
    Number.isFinite(Number(text));

  async function createDeposit(e) {
    e.preventDefault();

    setError("");

    if (!valid) {
      setError("Enter a valid deposit amount.");
      return;
    }

    setSaving(true);

    try {
      sessionStorage.removeItem("cmc_deposit_order");

      const r = await fetch("/api/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: text
        })
      });

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.error || "Unable to create deposit order."
        );
      }

      if (!d.order?.id) {
        throw new Error(
          "Deposit order was not created."
        );
      }

      /*
        Store the entire cashier assignment response.
        PaymentFlow reads this object.
      */
      sessionStorage.setItem(
        "cmc_deposit_order",
        JSON.stringify(d)
      );

      router.push("/payment");
    } catch (e) {
      setError(
        e?.message ||
        "Unable to create deposit order."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="form-card"
      onSubmit={createDeposit}
    >
      <label>
        Deposit Amount
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          disabled={saving}
        />
      </label>

      <p className="muted">
        Enter the amount you want to deposit.
        Global Nexus Capital will automatically identify your
        network and assign an available payment
        account.
      </p>

      {valid && (
        <section className="balance-card">
          <span>Deposit Amount</span>
          <strong>
            GHS{" "}
            {Number(amount).toLocaleString(
              "en-GH",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }
            )}
          </strong>
        </section>
      )}

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="primary-button"
        disabled={saving || !valid}
      >
        {saving
          ? "Creating Deposit..."
          : "Continue"}
      </button>
    </form>
  );
}
