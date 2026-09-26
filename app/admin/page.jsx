"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const modules = [
  ["Identity Verifications", "🪪", "/admin/verifications"],
  ["Events", "📅", "/admin/events"],
  ["Users", "👥", "/admin/users"],
  ["Tasks", "✓", "/admin/tasks"],

  ["Deposits", "↓", "/admin/deposits"],
  ["Payment Account Pool", "💳", "/admin/payment-pool"],
  ["Deposit Verification", "✓", "/admin/deposits"],

  ["Account Security", "🔒", "/admin/account-security"],
  ["User Security", "🌐", "/admin/user-security"],
  ["Business Security", "🛡", "/admin/business-security"],

  ["Content Management", "📄", "/admin/content"],
  ["Commission Management", "%", "/admin/commissions"],

  ["Withdrawals", "↑", "/admin/withdrawals"],
  ["Withdrawal Amounts", "₵", "/admin/withdrawal-amounts"],

  ["Fund Products", "📊", "/admin/funds"],
  ["Ranks", "🏆", "/admin/ranks"],

  ["Raffle Tickets", "🎟", "/admin/lucky-cards"],
  ["Points Cards", "⭐", "/admin/points-cards"],
  ["Bonus Draw", "🎁", "/admin/bonus-draw"],

  ["Company Activity", "📢", "/admin/company-activity"],
  ["Employee Office", "🏢", "/admin/employee-office"],
  ["Member Benefits", "🎁", "/admin/member-benefits"],

  ["Management Positions", "💼", "/admin/management-positions"],
  ["Management Salary", "💰", "/admin/referral-salary"],
  ["Team Expansion", "🌐", "/admin/team-expansion"],

  ["Messages", "💬", "/admin/messages"],

  ["Company / Legal Content", "📑", "/admin/content"],
  ["Global Settings", "⚙", "/admin/settings"],

  ["Password Recovery", "🔑", "/admin/password-recovery"],
  ["Verification Staff", "👨🏽‍💼", "/admin/verification-staff"],
  ["Audit Log", "📋", "/admin/audit"],
  ["Financial Analytics", "📈", "/admin/financial-analytics"],
  ["Staff Transaction Reports", "📊", "/admin/staff-transactions"],
];

export default function AdminDashboard() {
  const router = useRouter();

  const [pending, setPending] = useState({
    deposits: 0,
    withdrawals: 0,
    total: 0
  });

  const [userStats, setUserStats] = useState({
    total: 0,
    qualified: 0,
    unqualified: 0
  });

  useEffect(() => {
    async function loadPending() {
      try {
        const response = await fetch(
          "/api/admin/pending-count",
          {
            cache: "no-store"
          }
        );

        if (!response.ok) return;

        const data = await response.json();

        setPending({
          deposits: Number(data.deposits || 0),
          withdrawals: Number(data.withdrawals || 0),
          total: Number(data.total || 0)
        });
      } catch {
        // Keep dashboard usable if loading fails.
      }
    }

    loadPending();

    const interval = setInterval(
      loadPending,
      30000
    );

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadUserStats() {
      try {
        const response = await fetch(
          "/api/admin/user-stats",
          {
            cache: "no-store"
          }
        );

        if (!response.ok) return;

        const data = await response.json();

        setUserStats({
          total: Number(data.total || 0),
          qualified: Number(data.qualified || 0),
          unqualified: Number(data.unqualified || 0)
        });
      } catch {
        // Keep dashboard usable if loading fails.
      }
    }

    loadUserStats();

    const interval = setInterval(
      loadUserStats,
      30000
    );

    return () => clearInterval(interval);
  }, []);

  async function logout() {
    await fetch(
      "/api/auth/logout",
      {
        method: "POST"
      }
    );

    router.replace("/admin/login");
  }

  return (
    <main className="mobile-shell scroll-page admin-dashboard">

      <header className="admin-dashboard-header">

        
          <img className="global-brand-logo admin-brand-logo" src="/cmc-logo.jpeg" alt="Global Nexus Capital" />
<div className="admin-dashboard-title">

          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Dashboard
          </h1>

          <p>
            Manage your Global Nexus Capital platform
          </p>

        </div>

        <div className="admin-dashboard-actions">

          <Link
            href="/"
            className="admin-header-button"
          >
            User
          </Link>

          <button
            type="button"
            className="admin-header-button admin-logout-button"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </header>

      <section className="admin-pending-card">

        <div className="admin-pending-main">

          <span className="admin-pending-label">
            Action Required
          </span>

          <strong>
            {pending.total}
          </strong>

          <span className="admin-pending-text">
            Pending requests
          </span>

        </div>

        <div className="admin-pending-links">

          <Link href="/admin/deposits">

            <span>
              Deposits
            </span>

            <strong>
              {pending.deposits}
            </strong>

          </Link>

          <Link href="/admin/withdrawals">

            <span>
              Withdrawals
            </span>

            <strong>
              {pending.withdrawals}
            </strong>

          </Link>

        </div>

      </section>

      <section className="admin-card admin-user-stats-card">

        <div className="admin-card-head">

          <div>
            <strong>
              User Statistics
            </strong>

            <span className="muted">
              Current Global Nexus Capital user accounts
            </span>
          </div>

          <span className="badge">
            Live
          </span>

        </div>

        <div className="admin-user-stats-grid">

          <div className="stat-box">

            <span>
              Total Users
            </span>

            <strong>
              {userStats.total.toLocaleString()}
            </strong>

          </div>

          <div className="stat-box">

            <span>
              Qualified Users
            </span>

            <strong>
              {userStats.qualified.toLocaleString()}
            </strong>

          </div>

          <div className="stat-box">

            <span>
              Unqualified Users
            </span>

            <strong>
              {userStats.unqualified.toLocaleString()}
            </strong>

          </div>

        </div>

      </section>

      <section className="admin-modules-section">

        <div className="admin-modules-heading">

          <div>

            <span>
              CONTROL PANEL
            </span>

            <h2>
              Admin Modules
            </h2>

          </div>

          <small>
            {modules.length} modules
          </small>

        </div>

        <div className="admin-modules-grid">

          {modules.map(([label, icon, href]) => (

            <Link
              href={href}
              className="admin-module-card"
              key={label}
            >

              <div className="admin-module-icon">
                {icon}
              </div>

              <span className="admin-module-name">
                {label}
              </span>

              <span className="admin-module-arrow">
                ›
              </span>

            </Link>

          ))}

        </div>

      </section>

    </main>
  );
}
