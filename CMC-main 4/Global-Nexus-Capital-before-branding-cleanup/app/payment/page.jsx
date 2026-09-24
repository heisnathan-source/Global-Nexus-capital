import Link from "next/link";
import PaymentFlow from "@/app/components/PaymentFlow";
export default function Payment(){return <main className="mobile-shell scroll-page"><header className="topbar"><div><div className="eyebrow">Global Nexus Capital</div><h1>Payment</h1><p className="muted">Your assigned payment details</p></div><Link className="icon-button" href="/deposit">←</Link></header><PaymentFlow/></main>}
