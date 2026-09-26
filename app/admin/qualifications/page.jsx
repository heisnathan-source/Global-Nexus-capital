import Link from "next/link";
export default function Qualifications(){
 return <main className="mobile-shell scroll-page">
  <header className="topbar"><div><div className="eyebrow">GLOBAL NEXUS CAPITAL ADMIN</div><h1>Member Qualifications</h1><p className="muted">Starter qualification records</p></div><Link className="icon-button" href="/admin">←</Link></header>
  <section className="admin-card">
   <strong>Automatic qualification</strong>
   <p className="muted">When a qualifying rank purchase is successfully completed, Global Nexus Capital records the event and updates the member&apos;s direct-referral qualification status automatically.</p>
  </section>
  <section className="admin-card"><div className="admin-card-head"><strong>Qualification History</strong><span className="badge">Audited</span></div><div className="empty-document"><span>No qualification records loaded</span></div></section>
 </main>
}
