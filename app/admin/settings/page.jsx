"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const fields = [
  ["depositsEnabled", "Deposits"],
  ["withdrawalsEnabled", "Withdrawals"],
  ["bankDepositsEnabled", "Bank Deposits"],
  ["bankWithdrawalsEnabled", "Bank Withdrawals"],
  ["luckyCardsEnabled", "Raffle Tickets"],
  ["pointsCardsEnabled", "Points Cards"],
  ["companyActivityEnabled", "Company Activity"],
];

const days = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

const allDays = [0, 1, 2, 3, 4, 5, 6];

function normalizeTime(value, fallback) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : fallback;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    depositsEnabled: true,
    withdrawalsEnabled: true,
    bankDepositsEnabled: false,
    bankWithdrawalsEnabled: false,
    luckyCardsEnabled: false,
    pointsCardsEnabled: false,
    companyActivityEnabled: false,
  });

  const [withdrawalStartTime, setWithdrawalStartTime] =
    useState("08:00");
  const [withdrawalEndTime, setWithdrawalEndTime] =
    useState("17:00");
  const [ranks, setRanks] = useState([]);
  const [rankTaskDays, setRankTaskDays] = useState({});
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const rankCountLabel = useMemo(
    () => `${ranks.length} rank${ranks.length === 1 ? "" : "s"} configured`,
    [ranks.length]
  );

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/settings", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load settings.");
        }

        if (data.settings) {
          setSettings({
            depositsEnabled: data.settings.deposits_enabled,
            withdrawalsEnabled: data.settings.withdrawals_enabled,
            bankDepositsEnabled: data.settings.bank_deposits_enabled,
            bankWithdrawalsEnabled: data.settings.bank_withdrawals_enabled,
            luckyCardsEnabled: data.settings.lucky_cards_enabled,
            pointsCardsEnabled: data.settings.points_cards_enabled,
            companyActivityEnabled: data.settings.company_activity_enabled,
          });
        }

        const schedule = data.withdrawalSchedule || {};
        setWithdrawalStartTime(
          normalizeTime(schedule.withdrawal_start_time, "08:00")
        );
        setWithdrawalEndTime(
          normalizeTime(schedule.withdrawal_end_time, "17:00")
        );

        const loadedRanks = Array.isArray(data.ranks) ? data.ranks : [];
        setRanks(loadedRanks);

        const savedByRank = {};

        for (const row of data.rankTaskDays || []) {
          const rankKey = String(row.rank_id);
          if (!savedByRank[rankKey]) savedByRank[rankKey] = [];
          if (row.enabled) {
            savedByRank[rankKey].push(Number(row.weekday));
          }
        }

        const map = {};
        for (const rank of loadedRanks) {
          const rankKey = String(rank.id);
          map[rank.id] = Object.prototype.hasOwnProperty.call(
            savedByRank,
            rankKey
          )
            ? [...new Set(savedByRank[rankKey])].sort()
            : [...allDays];
        }

        setRankTaskDays(map);
      } catch (err) {
        setError(err.message || "Unable to load settings.");
      }
    }

    load();
  }, []);

  function toggle(key) {
    setSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function toggleRankDay(rankId, day) {
    setRankTaskDays((current) => {
      const existing = current[rankId] || [];
      return {
        ...current,
        [rankId]: existing.includes(day)
          ? existing.filter((value) => value !== day)
          : [...existing, day].sort(),
      };
    });
  }

  function setAllRankDays(rankId, enabled) {
    setRankTaskDays((current) => ({
      ...current,
      [rankId]: enabled ? [...allDays] : [],
    }));
  }

  async function save() {
    setStatus("Saving…");
    setError("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...settings,
          withdrawalStartTime,
          withdrawalEndTime,
          rankTaskDays: ranks.map((rank) => ({
            rankId: rank.id,
            days: rankTaskDays[rank.id] || [],
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Save failed.");
      }

      setStatus("Global settings saved successfully.");
    } catch (err) {
      setStatus("");
      setError(err.message || "Unable to save settings.");
    }
  }

  return (
    <main className="mobile-shell scroll-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">GLOBAL NEXUS CAPITAL ADMIN</div>
          <h1>Global Settings</h1>
          <p className="muted">Platform-wide controls</p>
        </div>

        <Link className="icon-button" href="/admin">←</Link>
      </header>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>Feature Controls</strong>
        </div>

        {fields.map(([key, label]) => (
          <div className="setting-row" key={key}>
            <span>{label}</span>
            <button
              type="button"
              className={settings[key] ? "status-on" : "status-off"}
              onClick={() => toggle(key)}
            >
              {settings[key] ? "ON" : "OFF"}
            </button>
          </div>
        ))}
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>Withdrawal Period</strong>
          <span className="badge">Ghana time (UTC)</span>
        </div>

        <p className="muted">
          Members can submit withdrawals only during this global time window.
          Existing day and rank withdrawal rules still apply.
        </p>

        <div className="setting-grid">
          <label>
            Opens at
            <input
              type="time"
              value={withdrawalStartTime}
              onChange={(event) => setWithdrawalStartTime(event.target.value)}
            />
          </label>

          <label>
            Closes at
            <input
              type="time"
              value={withdrawalEndTime}
              onChange={(event) => setWithdrawalEndTime(event.target.value)}
            />
          </label>
        </div>

        <p className="muted">Example: 08:00 to 17:00.</p>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>Rank Task Days</strong>
          <span className="badge">{rankCountLabel}</span>
        </div>

        <p className="muted">
          Choose which weekdays each rank can perform tasks. Unchecked days
          are blocked server-side as well as hidden from the task list.
        </p>

        {ranks.map((rank) => (
          <div className="rank-day-row" key={rank.id}>
            <div className="rank-day-header">
              <strong>
                {rank.rank_number ? `LV ${rank.rank_number} — ` : ""}
                {rank.name}
              </strong>
              <div className="rank-day-actions">
                <button
                  type="button"
                  className="small-button"
                  onClick={() => setAllRankDays(rank.id, true)}
                >
                  All days
                </button>
                <button
                  type="button"
                  className="small-button"
                  onClick={() => setAllRankDays(rank.id, false)}
                >
                  None
                </button>
              </div>
            </div>

            <div className="rank-day-grid">
              {days.map((day, index) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={(rankTaskDays[rank.id] || []).includes(index)}
                    onChange={() => toggleRankDay(rank.id, index)}
                  />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {!ranks.length && (
          <p className="muted">No ranks were found.</p>
        )}
      </section>

      <section className="admin-card">
        <button className="primary-button" type="button" onClick={save}>
          Save Global Settings
        </button>

        {status && <p className="auth-success">{status}</p>}
        {error && <p className="auth-error">{error}</p>}
      </section>

      <section className="admin-card">
        <strong>Network Prefixes</strong>
        <p className="muted">
          Network prefix management remains under the payment configuration controls.
        </p>
        <Link className="small-button" href="/admin/payment-pool">
          Manage Payment Pool
        </Link>
      </section>

      <style jsx>{`
        .rank-day-row {
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid rgba(255,255,255,.08);
        }

        .rank-day-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .rank-day-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .rank-day-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
        }

        .rank-day-grid label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          font-size: 12px;
        }

        @media (max-width: 520px) {
          .rank-day-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
