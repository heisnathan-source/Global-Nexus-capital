"use client";

import Link from "next/link";
import {
  useEffect,
  useState
} from "react";


const EMPTY_FORM = {
  id: "",
  eventId: "",
  rankId: "",
  drawsRequired: 1,
  drawNumber: 1,
  maxWinners: 0,
  prizeName: "",
  prizeAmount: 0,
  prizeType: "cash",
  boxPosition: 1,
  active: true
};


export default function LuckyAdmin() {

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [events, setEvents] =
    useState([]);

  const [ranks, setRanks] =
    useState([]);

  const [prizes, setPrizes] =
    useState([]);

  const [users, setUsers] =
    useState([]);

  const [userSearch, setUserSearch] =
    useState("");

  const [selectedUser, setSelectedUser] =
    useState("");

  const [grantEventId, setGrantEventId] =
    useState("");

  const [grantRankId, setGrantRankId] =
    useState("");

  const [grantDraws, setGrantDraws] =
    useState(1);

  const [grantMode, setGrantMode] =
    useState("user");

  const [msg, setMsg] =
    useState("");

  const [grantMsg, setGrantMsg] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [granting, setGranting] =
    useState(false);

  const [searchingUsers, setSearchingUsers] =
    useState(false);


  async function load() {

    setLoading(true);

    try {

      const response =
        await fetch(
          "/api/admin/lucky-cards",
          {
            credentials: "include",
            cache: "no-store"
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to load Raffle Ticket settings."
        );
      }

      setEvents(data.events || []);
      setRanks(data.ranks || []);
      setPrizes(data.prizes || []);

    } catch (error) {

      setMsg(
        error.message ||
        "Unable to load Raffle Ticket settings."
      );

    } finally {

      setLoading(false);

    }
  }


  useEffect(() => {
    load();
  }, []);


  function updateForm(field, value) {

    setForm((current) => ({
      ...current,
      [field]: value
    }));

  }


  function resetForm() {

    setForm({
      ...EMPTY_FORM
    });

    setMsg("");

  }


  async function searchUsers() {

    setGrantMsg("");

    setSearchingUsers(true);

    try {

      const response =
        await fetch(
          `/api/admin/users/search?q=${encodeURIComponent(
            userSearch
          )}`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to search users."
        );
      }

      setUsers(data.users || []);

      if (!(data.users || []).length) {

        setGrantMsg(
          "No users found."
        );

      }

    } catch (error) {

      setGrantMsg(
        error.message ||
        "Unable to search users."
      );

    } finally {

      setSearchingUsers(false);

    }
  }


  async function grantLuckyCards() {

    setGrantMsg("");

    const drawAmount =
      Math.trunc(Number(grantDraws));

    if (!grantEventId) {

      setGrantMsg(
        "Please select an event."
      );

      return;

    }

    if (
      !Number.isInteger(drawAmount) ||
      drawAmount < 1
    ) {

      setGrantMsg(
        "Raffle Ticket amount must be at least 1."
      );

      return;

    }

    if (
      grantMode === "user" &&
      !selectedUser
    ) {

      setGrantMsg(
        "Please select a user."
      );

      return;

    }

    if (
      grantMode === "rank" &&
      !grantRankId
    ) {

      setGrantMsg(
        "Please select a rank."
      );

      return;

    }

    setGranting(true);

    try {

      const response =
        await fetch(
          "/api/admin/lucky-cards/grant",
          {
            method: "POST",

            credentials: "include",

            headers: {
              "content-type":
                "application/json"
            },

            body: JSON.stringify({
              mode: grantMode,
              userId:
                grantMode === "user"
                  ? selectedUser
                  : null,
              rankId:
                grantMode === "rank"
                  ? grantRankId
                  : null,
              eventId: grantEventId,
              draws: drawAmount
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.error ||
          "Unable to give Raffle Tickets."
        );

      }

      setGrantMsg(
        data.message ||
        "Raffle Tickets given successfully."
      );

      setGrantDraws(1);

      if (grantMode === "user") {
        setSelectedUser("");
      }

    } catch (error) {

      setGrantMsg(
        error.message ||
        "Unable to give Raffle Tickets."
      );

    } finally {

      setGranting(false);

    }
  }


  function editPrize(prize) {

    if (Number(prize.draw_count || 0) > 0) {

      setMsg(
        "This rule already has draw history and cannot be edited. Create a new rule instead."
      );

      return;

    }

    setForm({
      id: prize.id,
      eventId: prize.event_id || "",
      rankId: prize.rank_id || "",
      drawsRequired:
        prize.draws_required || 1,
      drawNumber:
        prize.draw_number ||
        prize.draws_required ||
        1,
      maxWinners:
        prize.max_winners ?? 0,
      prizeName:
        prize.prize_name || "",
      prizeAmount:
        prize.prize_amount ?? 0,
      prizeType:
        prize.prize_type || "cash",
      boxPosition:
        prize.box_position || 1,
      active:
        prize.active !== false
    });

    setMsg(
      `Editing: ${prize.prize_name}`
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }


  async function save() {

    setMsg("");

    if (!form.eventId) {

      setMsg(
        "Please select an event."
      );

      return;

    }

    if (!String(form.prizeName).trim()) {

      setMsg(
        "Please enter a prize name."
      );

      return;

    }

    setSaving(true);

    try {

      const editing =
        Boolean(form.id);

      const response =
        await fetch(
          "/api/admin/lucky-cards",
          {
            method:
              editing ? "PUT" : "POST",

            credentials: "include",

            headers: {
              "content-type":
                "application/json"
            },

            body: JSON.stringify({
              id:
                editing
                  ? form.id
                  : undefined,

              eventId:
                form.eventId,

              rankId:
                form.rankId,

              drawsRequired:
                form.drawsRequired,

              drawNumber:
                form.drawNumber,

              maxWinners:
                form.maxWinners,

              prizeName:
                form.prizeName,

              prizeAmount:
                form.prizeAmount,

              prizeType:
                form.prizeType,

              boxPosition:
                form.boxPosition,

              active:
                form.active
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.error ||
          "Unable to save Raffle Ticket rule."
        );

      }

      setMsg(
        editing
          ? "Raffle Ticket rule updated successfully."
          : "Raffle Ticket rule created successfully."
      );

      resetForm();

      await load();

    } catch (error) {

      setMsg(
        error.message ||
        "Unable to save Raffle Ticket rule."
      );

    } finally {

      setSaving(false);

    }
  }


  async function togglePrize(prize) {

    setMsg("");

    try {

      const response =
        await fetch(
          "/api/admin/lucky-cards",
          {
            method: "PATCH",

            credentials: "include",

            headers: {
              "content-type":
                "application/json"
            },

            body: JSON.stringify({
              id: prize.id,
              active: !prize.active
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.error ||
          "Unable to update Raffle Ticket rule."
        );

      }

      setMsg(
        prize.active
          ? "Raffle Ticket rule deactivated."
          : "Raffle Ticket rule activated."
      );

      await load();

    } catch (error) {

      setMsg(
        error.message ||
        "Unable to update Raffle Ticket rule."
      );

    }
  }


  async function deletePrize(prize) {

    if (
      Number(prize.draw_count || 0) > 0
    ) {

      setMsg(
        "This rule has draw history and cannot be deleted."
      );

      return;

    }

    const confirmed =
      window.confirm(
        `Delete "${prize.prize_name}"?`
      );

    if (!confirmed) {
      return;
    }

    setMsg("");

    try {

      const response =
        await fetch(
          `/api/admin/lucky-cards?id=${encodeURIComponent(
            prize.id
          )}`,
          {
            method: "DELETE",
            credentials: "include"
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.error ||
          "Unable to delete Raffle Ticket rule."
        );

      }

      setMsg(
        "Raffle Ticket rule deleted successfully."
      );

      if (form.id === prize.id) {
        resetForm();
      }

      await load();

    } catch (error) {

      setMsg(
        error.message ||
        "Unable to delete Raffle Ticket rule."
      );

    }
  }


  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>

          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Raffle Tickets
          </h1>

          <p className="muted">
            Manage Raffle Ticket prizes and give draws to members.
          </p>

        </div>

        <div className="button-row">

          <Link
            href="/admin/lucky-prizes"
            className="secondary-button"
          >
            🎁 Prize Records
          </Link>

          <Link
            className="icon-button"
            href="/admin"
          >
            ←
          </Link>

        </div>

      </header>


      <section className="admin-card">

        <strong>
          Give Raffle Tickets
        </strong>

        <p className="muted">
          Give Raffle Ticket draws directly to a specific account or to all users in a selected rank.
        </p>


        <div className="form-card">

          <label>

            Give Raffle Tickets to

            <select
              value={grantMode}
              onChange={(e) => {
                setGrantMode(e.target.value);
                setGrantMsg("");
              }}
            >

              <option value="user">
                Specific account
              </option>

              <option value="rank">
                All users in a rank
              </option>

            </select>

          </label>


          <label>

            Event

            <select
              value={grantEventId}
              onChange={(e) =>
                setGrantEventId(
                  e.target.value
                )
              }
            >

              <option value="">
                Select event
              </option>

              {events.map((event) => (

                <option
                  key={event.id}
                  value={event.id}
                >
                  {event.name}
                </option>

              ))}

            </select>

          </label>


          {grantMode === "user" && (

            <>

              <label>

                Search account

                <input
                  value={userSearch}
                  placeholder="Name, phone or Global Nexus Capital account ID"
                  onChange={(e) =>
                    setUserSearch(
                      e.target.value
                    )
                  }
                  onKeyDown={(e) => {

                    if (e.key === "Enter") {

                      e.preventDefault();

                      searchUsers();

                    }

                  }}
                />

              </label>


              <button
                type="button"
                className="secondary-button"
                disabled={searchingUsers}
                onClick={searchUsers}
              >
                {
                  searchingUsers
                    ? "Searching..."
                    : "Search User"
                }
              </button>


              {users.length > 0 && (

                <label>

                  Select account

                  <select
                    value={selectedUser}
                    onChange={(e) =>
                      setSelectedUser(
                        e.target.value
                      )
                    }
                  >

                    <option value="">
                      Select user
                    </option>

                    {users.map((user) => (

                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.name} —{" "}
                        {user.account_id ||
                          `CMC-${String(
                            user.id
                          ).replace(
                            /-/g,
                            ""
                          ).slice(-8)}`}{" "}
                        — {user.rank_name}
                      </option>

                    ))}

                  </select>

                </label>

              )}

            </>

          )}


          {grantMode === "rank" && (

            <label>

              Select rank

              <select
                value={grantRankId}
                onChange={(e) =>
                  setGrantRankId(
                    e.target.value
                  )
                }
              >

                <option value="">
                  Select rank
                </option>

                {ranks.map((rank) => (

                  <option
                    key={rank.id}
                    value={rank.id}
                  >
                    {rank.name}
                  </option>

                ))}

              </select>

            </label>

          )}


          <label>

            Number of raffle ticket draws

            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={grantDraws}
              onChange={(e) =>
                setGrantDraws(
                  e.target.value
                )
              }
            />

          </label>


          <button
            type="button"
            className="primary-button"
            disabled={granting}
            onClick={grantLuckyCards}
          >
            {
              granting
                ? "Giving Raffle Tickets..."
                : "Give Raffle Tickets"
            }
          </button>


          {grantMsg && (

            <p className="muted">
              {grantMsg}
            </p>

          )}

        </div>

      </section>


      <section className="admin-card">

        <strong>
          {
            form.id
              ? "Edit Raffle Ticket Rule"
              : "Create Raffle Ticket Rule"
          }
        </strong>


        <div className="form-card">

          <label>

            Event

            <select
              value={form.eventId}
              onChange={(e) =>
                updateForm(
                  "eventId",
                  e.target.value
                )
              }
            >

              <option value="">
                Select event
              </option>

              {events.map((event) => (

                <option
                  key={event.id}
                  value={event.id}
                >
                  {event.name}
                </option>

              ))}

            </select>

          </label>


          <label>

            Rank

            <select
              value={form.rankId}
              onChange={(e) =>
                updateForm(
                  "rankId",
                  e.target.value
                )
              }
            >

              <option value="">
                All ranks
              </option>

              {ranks.map((rank) => (

                <option
                  key={rank.id}
                  value={rank.id}
                >
                  {rank.name}
                </option>

              ))}

            </select>

          </label>


          <div className="setting-grid">

            <label>

              Draw number

              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={form.drawNumber}
                onChange={(e) =>
                  updateForm(
                    "drawNumber",
                    e.target.value
                  )
                }
              />

            </label>


            <label>

              Maximum winners
              (0 = unlimited)

              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.maxWinners}
                onChange={(e) =>
                  updateForm(
                    "maxWinners",
                    e.target.value
                  )
                }
              />

            </label>


            <label>

              Prize name

              <input
                value={form.prizeName}
                onChange={(e) =>
                  updateForm(
                    "prizeName",
                    e.target.value
                  )
                }
              />

            </label>


            <label>

              Prize value

              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.prizeAmount}
                onChange={(e) =>
                  updateForm(
                    "prizeAmount",
                    e.target.value
                  )
                }
              />

            </label>

          </div>


          <label>

            Prize type

            <select
              value={form.prizeType}
              onChange={(e) =>
                updateForm(
                  "prizeType",
                  e.target.value
                )
              }
            >

              <option value="cash">
                Cash
              </option>

              <option value="points">
                Points
              </option>

              <option value="gift">
                Gift
              </option>

            </select>

          </label>


          <label>

            Raffle Ticket box position

            <select
              value={form.boxPosition}
              onChange={(e) =>
                updateForm(
                  "boxPosition",
                  Number(e.target.value)
                )
              }
            >

              <option value="1">
                Box 1
              </option>

              <option value="2">
                Box 2
              </option>

              <option value="3">
                Box 3
              </option>

              <option value="4">
                Box 4
              </option>

              <option value="5">
                Box 5
              </option>

              <option value="6">
                Box 6
              </option>

            </select>

          </label>


          <label className="list-row">

            <span>
              Rule active
            </span>

            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                updateForm(
                  "active",
                  e.target.checked
                )
              }
            />

          </label>


          <div className="button-row">

            <button
              type="button"
              className="primary-button"
              disabled={saving}
              onClick={save}
            >
              {
                saving
                  ? "Saving..."
                  : form.id
                    ? "Update Rule"
                    : "Save Rule"
              }
            </button>


            {form.id && (

              <button
                type="button"
                className="secondary-button"
                disabled={saving}
                onClick={resetForm}
              >
                Cancel Edit
              </button>

            )}

          </div>


          {msg && (

            <p className="muted">
              {msg}
            </p>

          )}

        </div>

      </section>


      <section className="admin-card">

        <strong>
          Saved Raffle Ticket Rules
        </strong>


        {loading ? (

          <p className="muted">
            Loading Raffle Ticket rules...
          </p>

        ) : prizes.length ? (

          prizes.map((prize) => (

            <div
              className="form-card"
              key={prize.id}
            >

              <div className="list-row">

                <strong>
                  {prize.prize_name}
                </strong>

                <span className="badge">
                  {prize.active
                    ? "Active"
                    : "Inactive"}
                </span>

              </div>


              <p className="muted">

                Event:{" "}
                {prize.event_name ||
                  "No event"}

                <br />

                Rank:{" "}
                {prize.rank_name ||
                  "All ranks"}

                <br />

                Draw number:{" "}
                {prize.draw_number ||
                  prize.draws_required}

                <br />

                Type:{" "}
                {prize.prize_type}

                <br />

                Value:{" "}
                {prize.prize_amount}

                <br />

                Maximum winners:{" "}
                {prize.max_winners === 0
                  ? "Unlimited"
                  : prize.max_winners}

                <br />

                Raffle Ticket box:{" "}
                Box {prize.box_position || 1}

                <br />

                Historical draws:{" "}
                {prize.draw_count || 0}

              </p>


              <div className="button-row">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    editPrize(prize)
                  }
                >
                  Edit
                </button>


                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    togglePrize(prize)
                  }
                >
                  {prize.active
                    ? "Deactivate"
                    : "Activate"}
                </button>


                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    deletePrize(prize)
                  }
                >
                  Delete
                </button>

              </div>

            </div>

          ))

        ) : (

          <p className="muted">
            No Raffle Ticket rules have been created yet.
          </p>

        )}

      </section>

    </main>
  );
}
