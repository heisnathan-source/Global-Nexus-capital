"use client";

import Link from "next/link";
import {
  useEffect,
  useState
} from "react";

const emptyAccount = {
  network: "",
  paymentNumber: "",
  recipientName: "",
  minAmount: "0",
  maxAmount: "",
  staffId: ""
};

const emptyPrefix = {
  prefix: "",
  network: ""
};

export default function PaymentPool() {
  const [accounts, setAccounts] =
    useState([]);

  const [prefixes, setPrefixes] =
    useState([]);

  const [networks, setNetworks] =
    useState([]);

  const [staff, setStaff] =
    useState([]);

  const [account, setAccount] =
    useState(emptyAccount);

  const [prefix, setPrefix] =
    useState(emptyPrefix);

  const [editingId, setEditingId] =
    useState(null);

  const [status, setStatus] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/payment-pool",
        {
          cache: "no-store"
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load payment pool."
        );
      }

      setAccounts(data.accounts || []);
      setPrefixes(data.prefixes || []);
      setNetworks(data.networks || []);
      setStaff(data.staff || []);

      if (
        !account.network &&
        data.networks?.length
      ) {
        setAccount((current) => ({
          ...current,
          network:
            data.networks[0].name
        }));
      }

      if (
        !prefix.network &&
        data.networks?.length
      ) {
        setPrefix((current) => ({
          ...current,
          network:
            data.networks[0].name
        }));
      }
    } catch (e) {
      setError(
        e?.message ||
          "Unable to load payment pool."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function post(body) {
    setStatus("Saving...");
    setError("");

    try {
      const response = await fetch(
        "/api/admin/payment-pool",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify(body)
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Save failed."
        );
      }

      setStatus(
        body.type === "updateAccount"
          ? "Payment account updated successfully."
          : "Saved successfully."
      );

      await load();
      return true;
    } catch (e) {
      setError(
        e?.message || "Save failed."
      );
      setStatus("");
      return false;
    }
  }

  async function saveAccount() {
    const ok = await post({
      type: editingId
        ? "updateAccount"
        : "account",
      ...(editingId
        ? { id: editingId }
        : {}),
      ...account
    });

    if (ok) {
      setAccount({
        ...emptyAccount,
        network:
          networks[0]?.name || ""
      });
      setEditingId(null);
    }
  }

  function editAccount(a) {
    setEditingId(a.id);

    setAccount({
      network: a.network || "",
      paymentNumber:
        a.payment_number || "",
      recipientName:
        a.recipient_name || "",
      minAmount:
        a.min_amount == null
          ? "0"
          : String(a.min_amount),
      maxAmount:
        a.max_amount == null
          ? ""
          : String(a.max_amount),
      staffId:
        a.assigned_staff_id || ""
    });

    setStatus("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function cancelEdit() {
    setEditingId(null);

    setAccount({
      ...emptyAccount,
      network:
        networks[0]?.name || ""
    });

    setStatus("");
    setError("");
  }

  async function savePrefix() {
    const ok = await post({
      type: "prefix",
      ...prefix
    });

    if (ok) {
      setPrefix({
        ...emptyPrefix,
        network:
          networks[0]?.name || ""
      });
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
            Payment Wallet Pool
          </h1>

          <p className="muted">
            Manage automatic cashier
            payment accounts, staff
            assignments and network
            prefixes.
          </p>
        </div>

        <Link
          className="icon-button"
          href="/admin"
        >
          ←
        </Link>
      </header>

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      {status && (
        <p className="auth-success">
          {status}
        </p>
      )}

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>
            Network Prefix
          </strong>

          <span className="badge">
            First 3 digits
          </span>
        </div>

        <div className="form-card">
          <label>
            Phone Prefix

            <input
              inputMode="numeric"
              maxLength={3}
              value={prefix.prefix}
              onChange={(e) =>
                setPrefix({
                  ...prefix,
                  prefix:
                    e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 3)
                })
              }
              placeholder="024"
            />
          </label>

          <label>
            Network

            <select
              value={prefix.network}
              onChange={(e) =>
                setPrefix({
                  ...prefix,
                  network:
                    e.target.value
                })
              }
            >
              <option value="">
                Select network
              </option>

              {networks.map((n) => (
                <option
                  key={n.id}
                  value={n.name}
                >
                  {n.name}
                </option>
              ))}
            </select>
          </label>

          <button
            className="primary-button"
            type="button"
            onClick={savePrefix}
            disabled={!networks.length}
          >
            Save Network Prefix
          </button>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>
            {editingId
              ? "Edit Payment Account"
              : "Payment Account"}
          </strong>

          <span className="badge">
            Admin controlled
          </span>
        </div>

        <div className="form-card">
          <label>
            Network

            <select
              value={account.network}
              onChange={(e) =>
                setAccount({
                  ...account,
                  network:
                    e.target.value
                })
              }
            >
              <option value="">
                Select network
              </option>

              {networks.map((n) => (
                <option
                  key={n.id}
                  value={n.name}
                >
                  {n.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Payment / Wallet Number

            <input
              inputMode="numeric"
              value={
                account.paymentNumber
              }
              onChange={(e) =>
                setAccount({
                  ...account,
                  paymentNumber:
                    e.target.value.replace(
                      /\s/g,
                      ""
                    )
                })
              }
              placeholder="0551234567"
            />
          </label>

          <label>
            Recipient Name

            <input
              value={
                account.recipientName
              }
              onChange={(e) =>
                setAccount({
                  ...account,
                  recipientName:
                    e.target.value
                })
              }
              placeholder="Global Nexus Capital Company"
            />
          </label>

          <label>
            Verification Staff

            <select
              value={account.staffId}
              onChange={(e) =>
                setAccount({
                  ...account,
                  staffId:
                    e.target.value
                })
              }
            >
              <option value="">
                Unassigned
              </option>

              {staff.map((member) => (
                <option
                  key={member.id}
                  value={member.id}
                >
                  {member.name}
                  {member.staff_login
                    ? ` · ${member.staff_login}`
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="setting-grid">
            <label>
              Minimum Amount

              <input
                inputMode="decimal"
                value={
                  account.minAmount
                }
                onChange={(e) =>
                  setAccount({
                    ...account,
                    minAmount:
                      e.target.value
                  })
                }
                placeholder="1"
              />
            </label>

            <label>
              Maximum Amount

              <input
                inputMode="decimal"
                value={
                  account.maxAmount
                }
                onChange={(e) =>
                  setAccount({
                    ...account,
                    maxAmount:
                      e.target.value
                  })
                }
                placeholder="5000"
              />
            </label>
          </div>

          <p className="muted">
            Leave maximum amount empty
            for unlimited.
          </p>

          <button
            className="primary-button"
            type="button"
            onClick={saveAccount}
          >
            {editingId
              ? "Update Payment Account"
              : "Save Payment Account"}
          </button>

          {editingId && (
            <button
              className="small-button"
              type="button"
              onClick={cancelEdit}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>
            Configured Accounts
          </strong>

          <span className="badge">
            {accounts.length}
          </span>
        </div>

        {loading ? (
          <p className="muted">
            Loading...
          </p>
        ) : accounts.length === 0 ? (
          <p className="muted">
            No payment accounts
            configured yet.
          </p>
        ) : (
          accounts.map((a) => (
            <div
              className="list-row"
              key={a.id}
            >
              <div>
                <strong>
                  {a.network} ·{" "}
                  {a.payment_number}
                </strong>

                <span className="muted">
                  {a.recipient_name}
                  {" · "}
                  GHS{" "}
                  {Number(
                    a.min_amount
                  ).toLocaleString()}
                  {" – "}
                  {a.max_amount == null
                    ? "Unlimited"
                    : Number(
                        a.max_amount
                      ).toLocaleString()}
                </span>

                <span className="muted">
                  Staff:{" "}
                  {a.assigned_staff_name ||
                    "Unassigned"}
                </span>

                <span className="muted">
                  {a.in_use
                    ? "Currently assigned"
                    : a.active
                    ? "Available"
                    : "Disabled"}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap"
                }}
              >
                <button
                  className="small-button"
                  type="button"
                  onClick={() =>
                    editAccount(a)
                  }
                >
                  Edit
                </button>

                <button
                  className="small-button"
                  type="button"
                  onClick={() =>
                    post({
                      type:
                        "toggleAccount",
                      id: a.id
                    })
                  }
                >
                  {a.active
                    ? "Disable"
                    : "Enable"}
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>
            Configured Prefixes
          </strong>

          <span className="badge">
            {prefixes.length}
          </span>
        </div>

        {prefixes.length === 0 ? (
          <p className="muted">
            No phone prefixes
            configured yet.
          </p>
        ) : (
          prefixes.map((p) => (
            <div
              className="list-row"
              key={p.id}
            >
              <div>
                <strong>
                  {p.prefix}
                </strong>

                <span className="muted">
                  {p.network}
                </span>

                <span className="muted">
                  {p.active
                    ? "Active"
                    : "Disabled"}
                </span>
              </div>

              <button
                className="small-button"
                type="button"
                onClick={() =>
                  post({
                    type:
                      "togglePrefix",
                    id: p.id
                  })
                }
              >
                {p.active
                  ? "Disable"
                  : "Enable"}
              </button>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
