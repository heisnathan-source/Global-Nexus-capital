"use client";
import Link from "next/link";
import { useParams } from "next/navigation";

const MODULES = {
  verifications: ["Identity Verifications", "Review government-name/ID verification requests.", "/account-security"],
  events: ["Events", "Manage events used by points, lucky cards and campaigns.", "/events"],
  users: ["Users", "Search and manage Global Nexus Capital user accounts.", "/mine"],
  tasks: ["Tasks", "Create and manage user tasks and task questions.", "/tasks"],
  deposits: ["Deposits", "Review pending deposit orders and verification status.", "/deposit"],
  "payment-pool": ["Payment Account Pool", "Manage payment accounts, recipient names, networks and limits.", "/deposit"],
  "account-security": ["Account Security", "Review identity verification and withdrawal activation.", "/account-security"],
  "business-security": ["Business Security", "Manage company/legal security content.", "/business-license"],
  content: ["Content Management", "Manage published user-facing content.", "/company-activity"],
  commissions: ["Commission Management", "Manage referral and task commission configuration.", "/rank"],
  withdrawals: ["Withdrawals", "Review and process withdrawal orders.", "/withdrawal"],
  funds: ["Fund Products", "Create and manage fund products.", "/fund-products"],
  ranks: ["Ranks", "Manage rank names, colours, requirements and earnings.", "/rank"],
  "lucky-cards": ["Lucky Cards", "Manage lucky-card events, eligibility and prizes.", "/lucky-cards"],
  "points-cards": ["Points Cards", "Manage points events, rewards and redemptions.", "/points-cards"],
  "company-activity": ["Company Activity", "Manage banners and activities shown to users.", "/company-activity"],
  "employee-office": ["Employee Office", "Manage Global Nexus Capital branches and branch content.", "/employee-office"],
  "member-benefits": ["Member Benefits", "Manage rank and membership benefits.", "/member-benefits"],
  "management-positions": ["Management Positions", "Manage position requirements, contracts and payments.", "/management-positions"],
  "team-expansion": ["Team Expansion", "Manage referral/team campaigns and settings.", "/team-expansion"],
  messages: ["Messages", "Create, publish and schedule Admin-only messages.", "/message"],
  settings: ["Global Settings", "Manage platform and feature settings.", "/settings"],
  audit: ["Audit Log", "Review administrative actions and financial changes.", "/financial-records"],
};

export default function AdminModulePage() {
  const params = useParams();
  const key = Array.isArray(params?.slug) ? params.slug.join("/") : params?.slug || "";
  const data = MODULES[key] || ["Admin Module", "This Admin module is available and protected, but its detailed controls are being implemented in a later correction pass.", "/"];
  const [title, description, userPath] = data;

  return <main className="mobile-shell scroll-page">
    <header className="topbar">
      <div><div className="eyebrow">GLOBAL NEXUS CAPITAL ADMIN</div><h1>{title}</h1><p className="muted">{description}</p></div>
      <Link className="icon-button" href="/admin">Dashboard</Link>
    </header>
    <section className="balance-card">
      <span>Admin control</span>
      <strong>{title}</strong>
      <p className="muted">This page is protected by the Admin authentication layer.</p>
    </section>
    <section className="feature-grid">
      <Link className="feature-card" href={userPath}><span className="feature-icon">↗</span><span>Open related user page</span></Link>
      <Link className="feature-card" href="/admin"><span className="feature-icon">←</span><span>Back to Admin Dashboard</span></Link>
    </section>
  </main>;
}
