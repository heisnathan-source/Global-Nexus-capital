import Link from "next/link";
export default function TeamAdmin(){
 return <main className="mobile-shell scroll-page">
  <header className="topbar"><div><div className="eyebrow">GLOBAL NEXUS CAPITAL ADMIN</div><h1>Team & Referrals</h1><p className="muted">Direct referral oversight</p></div><Link className="icon-button" href="/admin">←</Link></header>
  <section className="admin-card">
   <strong>Referral Rules</strong>
   <p className="muted">Global Nexus Capital uses direct referral links. There are no A/B/C referral categories. A member becomes Starter Qualified only after the configured Starter purchase/qualification event.</p>
  </section>
  <section className="admin-card">
   <div className="admin-card-head"><strong>Referral Commission</strong><span className="badge">8% / 2% / 1%</span></div>
   <p className="muted">Commission rules remain managed separately in Commission Management and are recorded against qualifying source transactions.</p>
  </section>
  <section className="admin-card"><strong>Team Records</strong><div className="empty-document"><span>Direct referral records will appear here.</span></div></section>
 </main>
}
