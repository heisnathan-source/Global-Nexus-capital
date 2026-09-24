import Link from "next/link";

const rules = [
  ["Direct Referral", "1st level", "8%"],
  ["Second Level", "2nd level", "2%"],
  ["Last Level", "3rd level", "1%"],
];

export default function Commissions() {
  return <main className="mobile-shell scroll-page">
    <header className="topbar">
      <div><div className="eyebrow">GLOBAL NEXUS CAPITAL ADMIN</div><h1>Commission Management</h1><p className="muted">Referral commission rules</p></div>
      <Link className="icon-button" href="/admin">←</Link>
    </header>

    <section className="admin-card">
      <div className="admin-card-head"><strong>Referral Commission Rules</strong><span className="badge">3 levels</span></div>
      {rules.map(([name, level, pct]) => (
        <div className="service-row" key={name}>
          <div><strong>{name}</strong><p className="muted">{level}</p></div>
          <div className="commission-value">{pct}</div>
        </div>
      ))}
    </section>

    <section className="admin-card">
      <strong>Commission protection</strong>
      <p className="muted">
        Each source transaction has an idempotent commission record, preventing the
        same referral commission from being credited twice.
      </p>
    </section>

    <section className="admin-card">
      <strong>Commission history</strong>
      <div className="empty-document"><span>No commission records loaded</span></div>
    </section>
  </main>;
}
