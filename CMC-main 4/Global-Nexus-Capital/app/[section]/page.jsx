import Link from "next/link";

const names = {
  "company-activity": "Company Activity",
  "employee-office": "Employee Office",
  "member-benefits": "Member Benefits",
  "management-positions": "Management Positions",
  "team-expansion": "Team Expansion",
  "lucky-cards": "Lucky Cards",
  "fund-products": "Fund Products",
  "deposit": "Deposit",
  "withdrawal": "Withdrawal",
  "task": "Task",
  "message": "Message",
  "rank": "Rank",
  "mine": "Mine"
};

export default async function SectionPage({ params }) {
  const { section } = await params;
  const title = names[section] || "Global Nexus Capital";
  const comingSoon = ["company-activity","employee-office","member-benefits"].includes(section);

  return (
    <main className="mobile-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Global Nexus Capital</div>
          <h1>{title}</h1>
        </div>
        <Link className="icon-button" href="/">←</Link>
      </header>

      <section className="balance-card">
        <span>{comingSoon ? "Status" : "Section"}</span>
        <strong>{comingSoon ? "Coming Soon" : title}</strong>
        <div className="account-meta">
          <span>Configuration</span>
          <span>Admin controlled</span>
        </div>
      </section>

      <section className="feature-card" style={{minHeight:160}}>
        <span className="feature-icon">✦</span>
        <div>
          <h2>{comingSoon ? "Coming Soon" : "Global Nexus Capital " + title}</h2>
          <p className="muted">
            This screen is connected to the Global Nexus Capital foundation and will use the
            production data model and Admin controls defined in the Master Build Specification.
          </p>
        </div>
      </section>
    </main>
  );
}
