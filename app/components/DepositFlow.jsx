"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DepositFlow() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentSenderName, setPaymentSenderName] =
    useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const amountText =
    String(amount).trim();

  const phoneText =
    String(paymentPhone).trim();

  const senderNameText =
    String(paymentSenderName)
      .trim()
      .replace(/\s+/g, " ");

  const validAmount =
    /^\d+(\.\d{1,2})?$/.test(
      amountText
    ) &&
    Number(amountText) > 0 &&
    Number.isFinite(Number(amountText));

  const normalizedPhone =
    phoneText.replace(/\D/g, "");

  const validPhone =
    normalizedPhone.length >= 3;

  const validSenderName =
    senderNameText.length >= 2 &&
    senderNameText.length <= 120;

  const valid =
    validAmount &&
    validPhone &&
    validSenderName;

  async function createDeposit(e) {
    e.preventDefault();

    setError("");

    if (!validAmount) {
      setError(
        "Enter a valid deposit amount."
      );
      return;
    }

    if (!validPhone) {
      setError(
        "Enter the phone number you will use to make the payment."
      );
      return;
    }

    if (!validSenderName) {
      setError(
        "Enter the name registered to the payment phone number."
      );
      return;
    }

    setSaving(true);

    try {
      sessionStorage.removeItem(
        "cmc_deposit_order"
      );

      const r = await fetch(
        "/api/deposit",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            amount: amountText,
            paymentPhone:
              normalizedPhone,
            paymentSenderName:
              senderNameText
          })
        }
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.error ||
            "Unable to create deposit order."
        );
      }

      if (!d.order?.id) {
        throw new Error(
          "Deposit order was not created."
        );
      }

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
          onChange={(e) =>
            setAmount(
              e.target.value
            )
          }
          placeholder="Enter amount"
          disabled={saving}
        />
      </label>

      <label>
        Payment Phone Number
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={paymentPhone}
          onChange={(e) =>
            setPaymentPhone(
              e.target.value
            )
          }
          placeholder="e.g. 024 123 4567"
          disabled={saving}
        />
      </label>

      <p className="muted">
        Enter the phone number you will
        use to make this payment.
      </p>

      <label>
        Name on Payment Account
        <input
          type="text"
          autoComplete="name"
          value={paymentSenderName}
          onChange={(e) =>
            setPaymentSenderName(
              e.target.value
            )
          }
          placeholder="Enter sender name"
          maxLength={120}
          disabled={saving}
        />
      </label>

      <p className="muted">
        Enter the name registered to the
        payment phone number you are
        sending the money from. This is
        separate from your Global Nexus Capital account name.
      </p>

      {validAmount && (
        <section className="balance-card">
          <span>
            Deposit Amount
          </span>

          <strong>
            GHS{" "}
            {Number(
              amount
            ).toLocaleString(
              "en-GH",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }
            )}
          </strong>
        </section>
      )}

      {validPhone && (
        <section className="balance-card">
          <span>
            Payment Phone
          </span>

          <strong>
            {normalizedPhone}
          </strong>
        </section>
      )}

      {validSenderName && (
        <section className="balance-card">
          <span>
            Payment Sender
          </span>

          <strong>
            {senderNameText}
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
        disabled={
          saving ||
          !valid
        }
      >
        {saving
          ? "Creating Deposit..."
          : "Continue"}
      </button>
    </form>
  );
}
