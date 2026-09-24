import Link from "next/link";
import WithdrawalFlow from "@/app/components/WithdrawalFlow";
export default function Withdrawal(){return <main className="mobile-shell scroll-page"><header className="topbar"><div><div className="eyebrow">Global Nexus Capital</div><h1>Withdrawal</h1><p className="muted">Withdraw from your Global Nexus Capital wallet</p></div><Link className="icon-button" href="/mine">←</Link></header><section className="admin-card"><div className="admin-card-head"><strong>Withdrawal Request</strong><span className="badge">Secure</span></div><WithdrawalFlow/></section></main>}
