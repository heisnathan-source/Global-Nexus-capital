import Link from "next/link";
import DepositFlow from "@/app/components/DepositFlow";

export default function Deposit() {
  return (
    <main className="mobile-shell scroll-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">Global Nexus Capital</div>
          <h1>Deposit</h1>
          <p className="muted">
            Add funds to your Global Nexus Capital wallet
          </p>
        </div>

        <Link
          className="icon-button"
          href="/mine"
        >
          ←
        </Link>
      </header>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>Choose Deposit Amount</strong>

          <span className="badge">
            Select one
          </span>
        </div>

        <DepositFlow />
      </section>

      <section className="admin-card">
        <strong>Payment Information</strong>

        <p className="muted">
          Your payment details will be provided after you continue.
        </p>

        <div className="empty-document">
          <span>
            Continue to receive your payment details.
          </span>
        </div>
      </section>
    </main>
  );
}
