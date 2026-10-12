"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const DAYS = [
  ["Sunday", 0],
  ["Monday", 1],
  ["Tuesday", 2],
  ["Wednesday", 3],
  ["Thursday", 4],
  ["Friday", 5],
  ["Saturday", 6]
];

export default function IndividualUserControlDetail() {
  const params = useParams();
  const userId = params.userId;

  const [user, setUser] = useState(null);
  const [ranks, setRanks] = useState([]);
  const [days, setDays] = useState(null);
  const [amount, setAmount] = useState("");
  const [rankId, setRankId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [withdrawalBlockBusy, setWithdrawalBlockBusy] = useState(false);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/individual-user-controls/${userId}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load user.");
      }

      setUser(data.user);
      setRanks(data.ranks || []);
      setDays(data.user.withdrawal_days === null
        ? null
        : (data.user.withdrawal_days || []).map(Number));
      setAmount(data.user.locked_withdrawal_amount == null
        ? ""
        : String(data.user.locked_withdrawal_amount));
      setRankId(data.user.rank_id || "");
    } catch (err) {
      setError(err.message || "Unable to load user.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  function toggleDay(day) {
    const current = days === null ? [] : days;

    setDays(
      current.includes(day)
        ? current.filter(value => value !== day)
        : [...current, day].sort((a, b) => a - b)
    );
  }

  async function toggleWithdrawalBlock() {
    const currentlyBlocked = user.withdrawals_blocked === true;
    const action = currentlyBlocked ? "unblock" : "block";

    if (!window.confirm(
      `Are you sure you want to ${action} withdrawals for this user?`
    )) {
      return;
    }

    setWithdrawalBlockBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/admin/individual-user-controls/${userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            withdrawalsBlocked: !currentlyBlocked,
            withdrawalDays: days,
            lockedWithdrawalAmount: amount === "" ? null : amount,
            rankId: rankId || null
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update withdrawal access.");
      }

      setMessage(
        currentlyBlocked
          ? "Withdrawals have been unblocked for this user."
          : "Withdrawals have been blocked for this user."
      );

      await loadUser();
    } catch (err) {
      setError(err.message || "Unable to update withdrawal access.");
    } finally {
      setWithdrawalBlockBusy(false);
    }
  }

  async function saveControls(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/admin/individual-user-controls/${userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            withdrawalDays: days,
            lockedWithdrawalAmount: amount === "" ? null : amount,
            rankId: rankId || null
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save.");
      }

      setMessage("User controls saved successfully.");
      await loadUser();
    } catch (err) {
      setError(err.message || "Unable to save controls.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main style={{ padding: 24 }}>Loading user…</main>;
  }

  if (!user) {
    return (
      <main style={{ padding: 24 }}>
        <Link href="/admin/individual-user-controls">
          ← Back to user search
        </Link>
        <p role="alert">{error || "User not found."}</p>
      </main>
    );
  }

  return (
    <main style={{
      maxWidth: 850,
      margin: "0 auto",
      padding: 24
    }}>
      <Link href="/admin/individual-user-controls">
        ← Back to user search
      </Link>

      <h1 style={{ marginTop: 24 }}>
        Individual User Settings
      </h1>

      <section style={{
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 10,
        margin: "20px 0"
      }}>
        <h2>{user.name || "Unnamed user"}</h2>
        <p>Account ID: {user.account_id || "—"}</p>
        <p>Phone: {user.phone || "—"}</p>
        <p>Current rank: {user.rank_name || "STARTER"}</p>
        <p>Identity status: {user.identity_status || "Unknown"}</p>
      </section>

      <section style={{
        margin: "20px 0",
        padding: 18,
        border: "1px solid #ddd",
        borderRadius: 10
      }}>
        <h2>Withdrawal Access</h2>

        <p>
          Current status:{" "}
          <strong>
            {user.withdrawals_blocked === true
              ? "BLOCKED"
              : "ALLOWED — normal withdrawal rules apply"}
          </strong>
        </p>

        <p>
          This control affects withdrawal requests for this user only.
          Other individual withdrawal settings remain unchanged.
        </p>

        <button
          type="button"
          onClick={toggleWithdrawalBlock}
          disabled={withdrawalBlockBusy}
          style={{
            padding: "12px 18px",
            borderRadius: 8,
            border: "none",
            cursor: withdrawalBlockBusy ? "wait" : "pointer",
            background: user.withdrawals_blocked === true ? "#167d45" : "#b42318",
            color: "#fff"
          }}
        >
          {withdrawalBlockBusy
            ? "Updating..."
            : user.withdrawals_blocked === true
              ? "Unblock Withdrawals"
              : "Block Withdrawals"}
        </button>
      </section>

      <form onSubmit={saveControls}>
        <section style={{ marginBottom: 28 }}>
          <h2>Allowed Withdrawal Days</h2>

          <p>
            Choose the days allowed for this user only.
            These settings override the normal global and rank
            day schedules for this user.
          </p>

          <label style={{ display: "block", marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={days === null}
              onChange={() => setDays(days === null ? [] : null)}
            />{" "}
            Use normal platform and rank schedule
          </label>

          {DAYS.map(([label, day]) => (
            <label
              key={day}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                margin: "6px 14px 6px 0"
              }}
            >
              <input
                type="checkbox"
                disabled={days === null}
                checked={days !== null && days.includes(day)}
                onChange={() => toggleDay(day)}
              />
              {label}
            </label>
          ))}

          {days !== null && days.length === 0 && (
            <p>
              No days selected: this user&apos;s withdrawal requests
              will be blocked on every day.
            </p>
          )}
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2>Lock Withdrawal Amount</h2>

          <p>
            Enter an exact amount, for example 100.00.
            Leave blank to use the normal approved amount list.
          </p>

          <label>
            Exact amount (GHS)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={event => setAmount(event.target.value)}
              placeholder="Leave blank for normal amounts"
              style={{
                display: "block",
                width: "100%",
                maxWidth: 350,
                padding: 10,
                marginTop: 8
              }}
            />
          </label>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2>Assign Rank</h2>

          <label>
            User rank
            <select
              value={rankId}
              onChange={event => setRankId(event.target.value)}
              style={{
                display: "block",
                width: "100%",
                maxWidth: 350,
                padding: 10,
                marginTop: 8
              }}
            >
              <option value="">No rank selected</option>
              {ranks.map(rank => (
                <option key={rank.id} value={rank.id}>
                  {rank.name} — Rank {rank.rank_number}
                </option>
              ))}
            </select>
          </label>
        </section>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          style={{ padding: "12px 20px" }}
        >
          {saving ? "Saving…" : "Save Individual Settings"}
        </button>
      </form>

      <section style={{ marginTop: 24, padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2>Task Access</h2>
        <p>Allow or block tasks for this user without changing other accounts.</p>
        <a href={`/admin/individual-user-controls/${encodeURIComponent(userId)}/tasks`}>
          Manage Individual Task Access
        </a>
      </section>
</main>
  );
}
