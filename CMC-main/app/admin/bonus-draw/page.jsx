"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

export default function BonusDrawAdminPage() {
  const [settings, setSettings] = useState({
    enabled: true,
    reward_percentage: 0,
    week_starts_on: 1
  });

  const [stages, setStages] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [savingSettings, setSavingSettings] =
    useState(false);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  /*
    Bonus Draw user search.
  */
  const [userSearch, setUserSearch] =
    useState("");

  const [searchResults, setSearchResults] =
    useState([]);

  const [searchingUsers, setSearchingUsers] =
    useState(false);

  const [selectedUser, setSelectedUser] =
    useState(null);

  const [rechecking, setRechecking] =
    useState(false);

  const [newStage, setNewStage] =
    useState({
      stageNumber: "",
      requiredDeposit: "",
      active: true
    });

  async function loadBonusDraw() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/bonus-draw",
        {
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to load Bonus Draw."
        );
      }

      if (data.settings) {
        setSettings({
          enabled:
            Boolean(data.settings.enabled),

          reward_percentage:
            Number(
              data.settings.reward_percentage || 0
            ),

          week_starts_on:
            Number(
              data.settings.week_starts_on ?? 1
            )
        });
      }

      setStages(data.stages || []);

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Unable to load Bonus Draw."
      );

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBonusDraw();
  }, []);

  async function saveSettings() {
    try {
      setSavingSettings(true);
      setStatus("");
      setError("");

      const response = await fetch(
        "/api/admin/bonus-draw",
        {
          method: "PUT",

          headers: {
            "content-type":
              "application/json"
          },

          body: JSON.stringify({
            enabled: settings.enabled,

            rewardPercentage:
              Number(
                settings.reward_percentage
              ),

            weekStartsOn:
              Number(
                settings.week_starts_on
              )
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to save settings."
        );
      }

      setStatus(
        "Bonus Draw settings saved successfully."
      );

      await loadBonusDraw();

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Unable to save settings."
      );

    } finally {
      setSavingSettings(false);
    }
  }

  async function createStage() {
    try {
      setStatus("");
      setError("");

      const stageNumber =
        Number(newStage.stageNumber);

      const requiredDeposit =
        Number(newStage.requiredDeposit);

      const response = await fetch(
        "/api/admin/bonus-draw",
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json"
          },

          body: JSON.stringify({
            stageNumber,
            requiredDeposit,
            active:
              Boolean(newStage.active)
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to create stage."
        );
      }

      setNewStage({
        stageNumber: "",
        requiredDeposit: "",
        active: true
      });

      setStatus(
        "Bonus Draw stage created successfully."
      );

      await loadBonusDraw();

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Unable to create stage."
      );
    }
  }

  function updateStageLocal(
    index,
    field,
    value
  ) {
    setStages(current =>
      current.map((stage, i) =>
        i === index
          ? {
              ...stage,
              [field]: value
            }
          : stage
      )
    );
  }

  async function saveStage(stage) {
    try {
      setStatus("");
      setError("");

      const response = await fetch(
        "/api/admin/bonus-draw",
        {
          method: "PATCH",

          headers: {
            "content-type":
              "application/json"
          },

          body: JSON.stringify({
            stageId: stage.id,

            stageNumber:
              Number(stage.stage_number),

            requiredDeposit:
              Number(stage.required_deposit),

            active:
              Boolean(stage.active)
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to save stage."
        );
      }

      setStatus(
        `Stage ${stage.stage_number} saved successfully.`
      );

      await loadBonusDraw();

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Unable to save stage."
      );
    }
  }

  async function deleteStage(stage) {
    const confirmed = window.confirm(
      `Delete Stage ${stage.stage_number}?`
    );

    if (!confirmed) return;

    try {
      setStatus("");
      setError("");

      const response = await fetch(
        "/api/admin/bonus-draw",
        {
          method: "DELETE",

          headers: {
            "content-type":
              "application/json"
          },

          body: JSON.stringify({
            stageId: stage.id
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to delete stage."
        );
      }

      setStatus(
        `Stage ${stage.stage_number} deleted successfully.`
      );

      await loadBonusDraw();

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Unable to delete stage."
      );
    }
  }

  async function searchUsers() {
    const query = userSearch.trim();

    if (!query) {
      setError(
        "Enter a name, phone number, Account ID, or User ID."
      );

      return;
    }

    try {
      setSearchingUsers(true);
      setStatus("");
      setError("");
      setSearchResults([]);
      setSelectedUser(null);

      const response = await fetch(
        `/api/admin/bonus-draw/recheck?query=${encodeURIComponent(query)}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to search for users."
        );
      }

      const users = data.users || [];

      setSearchResults(users);

      if (!users.length) {
        setStatus(
          "No users were found matching that search."
        );
      }

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Unable to search for users."
      );

    } finally {
      setSearchingUsers(false);
    }
  }

  function selectUser(user) {
    setSelectedUser(user);

    setStatus(
      `${user.name || "User"} selected for Bonus Draw recheck.`
    );

    setError("");
  }

  async function recheckEligibleRewards() {
    if (!selectedUser?.id) {
      setError(
        "Search for and select a user first."
      );

      return;
    }

    const confirmed = window.confirm(
      `Recheck Bonus Draw eligibility and credit any missing rewards for ${selectedUser.name || "this user"}?`
    );

    if (!confirmed) return;

    try {
      setRechecking(true);
      setStatus("");
      setError("");

      const response = await fetch(
        "/api/admin/bonus-draw/recheck",
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json"
          },

          body: JSON.stringify({
            userId: selectedUser.id
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to recheck Bonus Draw rewards."
        );
      }

      const rewards =
        data.result?.rewards || [];

      if (rewards.length) {
        setStatus(
          `${rewards.length} missing Bonus Draw reward(s) processed successfully for ${selectedUser.name || "the selected user"}.`
        );
      } else {
        setStatus(
          `Recheck completed for ${selectedUser.name || "the selected user"}. No missing eligible rewards were found.`
        );
      }

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Unable to recheck Bonus Draw rewards."
      );

    } finally {
      setRechecking(false);
    }
  }

  if (loading) {
    return (
      <main className="mobile-shell scroll-page">
        <p className="muted">
          Loading Bonus Draw settings...
        </p>
      </main>
    );
  }

  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>
          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Bonus Draw
          </h1>

          <p className="muted">
            Manage weekly deposit rewards and
            Bonus Draw stages.
          </p>
        </div>

        <Link
          href="/admin"
          className="icon-button"
        >
          ←
        </Link>

      </header>

      {status && (
        <p className="auth-success">
          {status}
        </p>
      )}

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      <section className="admin-card">

        <div className="admin-card-head">
          <strong>
            Global Settings
          </strong>

          <span className="badge">
            Platform Control
          </span>
        </div>

        <div className="setting-grid">

          <label>
            Bonus Draw Status

            <select
              value={
                settings.enabled
                  ? "enabled"
                  : "disabled"
              }

              onChange={e =>
                setSettings(current => ({
                  ...current,
                  enabled:
                    e.target.value ===
                    "enabled"
                }))
              }
            >
              <option value="enabled">
                Enabled
              </option>

              <option value="disabled">
                Disabled
              </option>
            </select>
          </label>

          <label>
            Reward Percentage (%)

            <input
              type="number"
              min="0"
              step="0.01"

              value={
                settings.reward_percentage
              }

              onChange={e =>
                setSettings(current => ({
                  ...current,
                  reward_percentage:
                    e.target.value
                }))
              }
            />
          </label>

          <label>
            Week Starts On

            <select
              value={
                settings.week_starts_on
              }

              onChange={e =>
                setSettings(current => ({
                  ...current,
                  week_starts_on:
                    Number(e.target.value)
                }))
              }
            >
              {DAYS.map((day, index) => (
                <option
                  key={day}
                  value={index}
                >
                  {day}
                </option>
              ))}
            </select>
          </label>

        </div>

        <button
          type="button"
          className="primary-button"
          disabled={savingSettings}
          onClick={saveSettings}
        >
          {savingSettings
            ? "Saving..."
            : "Save Global Settings"}
        </button>

      </section>

      <section className="admin-card">

        <div className="admin-card-head">
          <strong>
            Recheck User Rewards
          </strong>

          <span className="badge">
            Search User
          </span>
        </div>

        <p className="muted">
          Search using the user&apos;s name, phone number,
          Account ID, or User ID.
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 14
          }}
        >

          <input
            type="text"
            placeholder="Search name, phone, Account ID or User ID"
            value={userSearch}
            onChange={event =>
              setUserSearch(event.target.value)
            }
            onKeyDown={event => {
              if (event.key === "Enter") {
                searchUsers();
              }
            }}
            style={{
              flex: "1 1 220px"
            }}
          />

          <button
            type="button"
            className="primary-button"
            onClick={searchUsers}
            disabled={searchingUsers}
          >
            {searchingUsers
              ? "Searching..."
              : "Search User"}
          </button>

        </div>

        {searchResults.length > 0 && (

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gap: 10
            }}
          >

            {searchResults.map(user => (

              <button
                key={user.id}
                type="button"
                onClick={() =>
                  selectUser(user)
                }
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 12,
                  border:
                    selectedUser?.id === user.id
                      ? "2px solid currentColor"
                      : "1px solid rgba(128,128,128,.35)",
                  background: "transparent",
                  cursor: "pointer"
                }}
              >

                <strong>
                  {user.name || "Unnamed User"}
                </strong>

                <div
                  className="muted"
                  style={{
                    marginTop: 6
                  }}
                >
                  Phone: {
                    user.phone_number ||
                    user.phone ||
                    "Not available"
                  }
                </div>

                <div
                  className="muted"
                  style={{
                    marginTop: 4
                  }}
                >
                  Account ID: {
                    user.account_id ||
                    "Not available"
                  }
                </div>

                <div
                  className="muted"
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    wordBreak: "break-all"
                  }}
                >
                  User ID: {user.id}
                </div>

              </button>

            ))}

          </div>

        )}

        {selectedUser && (

          <div
            className="admin-card"
            style={{
              marginTop: 18
            }}
          >

            <div className="admin-card-head">

              <strong>
                Selected User
              </strong>

              <span className="badge">
                Ready
              </span>

            </div>

            <p>
              <strong>
                {selectedUser.name || "Unnamed User"}
              </strong>
            </p>

            <p className="muted">
              Phone: {
                selectedUser.phone_number ||
                selectedUser.phone ||
                "Not available"
              }
            </p>

            <p className="muted">
              Account ID: {
                selectedUser.account_id ||
                "Not available"
              }
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={recheckEligibleRewards}
              disabled={rechecking}
            >
              {rechecking
                ? "Rechecking..."
                : "Recheck Bonus Draw"}
            </button>

          </div>

        )}

      </section>

      <section className="admin-card">

        <div className="admin-card-head">
          <strong>
            Add Bonus Draw Stage
          </strong>

          <span className="badge">
            Unlimited Stages
          </span>
        </div>

        <div className="setting-grid">

          <label>
            Stage Number

            <input
              type="number"
              min="1"

              value={
                newStage.stageNumber
              }

              onChange={e =>
                setNewStage(current => ({
                  ...current,
                  stageNumber:
                    e.target.value
                }))
              }
            />
          </label>

          <label>
            Required Deposit (GHS)

            <input
              type="number"
              min="0.01"
              step="0.01"

              value={
                newStage.requiredDeposit
              }

              onChange={e =>
                setNewStage(current => ({
                  ...current,
                  requiredDeposit:
                    e.target.value
                }))
              }
            />
          </label>

          <label>
            Stage Status

            <select
              value={
                newStage.active
                  ? "active"
                  : "inactive"
              }

              onChange={e =>
                setNewStage(current => ({
                  ...current,
                  active:
                    e.target.value ===
                    "active"
                }))
              }
            >
              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>
          </label>

        </div>

        <button
          type="button"
          className="primary-button"
          onClick={createStage}
        >
          Add Bonus Draw Stage
        </button>

      </section>

      <section className="admin-card">

        <div className="admin-card-head">
          <strong>
            Existing Bonus Draw Stages
          </strong>

          <span className="badge">
            {stages.length} Total
          </span>
        </div>

        {stages.length === 0 ? (

          <p className="muted">
            No Bonus Draw stages have been
            created yet.
          </p>

        ) : (

          stages.map((stage, index) => (

            <div
              key={stage.id}
              className="admin-card"
              style={{
                marginTop: 16
              }}
            >

              <div className="admin-card-head">

                <strong>
                  Stage {
                    stage.stage_number
                  }
                </strong>

                <span className="badge">
                  {stage.active
                    ? "Active"
                    : "Inactive"}
                </span>

              </div>

              <div className="setting-grid">

                <label>
                  Stage Number

                  <input
                    type="number"
                    min="1"

                    value={
                      stage.stage_number
                    }

                    onChange={e =>
                      updateStageLocal(
                        index,
                        "stage_number",
                        e.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Required Deposit (GHS)

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"

                    value={
                      stage.required_deposit
                    }

                    onChange={e =>
                      updateStageLocal(
                        index,
                        "required_deposit",
                        e.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Status

                  <select
                    value={
                      stage.active
                        ? "active"
                        : "inactive"
                    }

                    onChange={e =>
                      updateStageLocal(
                        index,
                        "active",
                        e.target.value ===
                          "active"
                      )
                    }
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </label>

              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 14
                }}
              >

                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    saveStage(stage)
                  }
                >
                  Save Stage
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    deleteStage(stage)
                  }
                >
                  Delete
                </button>

              </div>

            </div>

          ))

        )}

      </section>

    </main>
  );
}
