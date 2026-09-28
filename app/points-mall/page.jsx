import Link from "next/link";

export default function PointsMall() {
  return (
    <main className="mobile-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">GLOBAL NEXUS CAPITAL</div>
          <h1>Points Mall</h1>
        </div>

        <Link
          className="icon-button"
          href="/mine"
          aria-label="Back to Mine"
        >
          ←
        </Link>
      </header>

      <section className="balance-card">
        <span>Points Mall</span>
        <strong>Redeem Your Points</strong>

        <div className="account-meta">
          <span>Rewards</span>
          <span>Coming Soon</span>
        </div>
      </section>

      <section
        className="feature-card"
        style={{ minHeight: 180 }}
      >
        <span className="feature-icon">🛍️</span>

        <div>
          <h2>Points Mall</h2>

          <p className="muted">
            Browse available rewards and redeem your points
            when rewards are available.
          </p>

          <p className="muted">
            The Points Mall is currently being prepared.
          </p>
        </div>
      </section>
    </main>
  );
}
