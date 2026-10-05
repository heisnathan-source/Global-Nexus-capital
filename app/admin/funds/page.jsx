"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const emptyForm = {
  id: "",
  name: "",
  description: "",
  interestRate: "",
  termDays: "30",
  minimumAmount: "",
  maximumAmount: "",
  displayOrder: "0",
  active: true,
  imageUrl: "",
};

export default function FundsAdmin() {
  const [f, setF] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const r = await fetch(
      "/api/admin/funds"
    );

    const d = await r.json();

    if (r.ok) {
      setRows(d.products || []);
    } else {
      setError(
        d.error ||
          "Unable to load products."
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  const set = (key, value) =>
    setF((x) => ({
      ...x,
      [key]: value,
    }));

  function editProduct(product) {
    setF({
      id: product.id,
      name: product.name || "",
      description:
        product.description || "",
      interestRate:
        product.interest_rate ?? "",
      termDays:
        product.period_days ?? "30",
      minimumAmount:
        product.min_purchase ?? "",
      maximumAmount:
        product.max_purchase ?? "",
      displayOrder:
        product.display_order ?? "0",
      active:
        product.active !== false,
      imageUrl:
        product.image_url || "",
    });

    setFile(null);
    setStatus(
      `Editing ${product.name}`
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    setF(emptyForm);
    setFile(null);
    setStatus("");
    setError("");
  }

  async function save(e) {
    e.preventDefault();

    try {
      setStatus(
        f.id
          ? "Updating…"
          : "Saving…"
      );
      setError("");

      let imageUrl = f.imageUrl;

      if (file) {
        const fd = new FormData();

        fd.append("file", file);
        fd.append(
          "folder",
          "fund-products"
        );

        const r = await fetch(
          "/api/admin/media",
          {
            method: "POST",
            body: fd,
          }
        );

        const d = await r.json();

        if (!r.ok) {
          throw new Error(
            d.error ||
              "Image upload failed."
          );
        }

        imageUrl = d.url;
      }

      const payload = {
        ...f,
        imageUrl,
      };

      const r = await fetch(
        "/api/admin/funds",
        {
          method: f.id
            ? "PUT"
            : "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify(
            payload
          ),
        }
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.error ||
            "Unable to save product."
        );
      }

      setStatus(
        f.id
          ? "Fund product updated successfully."
          : "Fund product created successfully."
      );

      setF(emptyForm);
      setFile(null);

      await load();
    } catch (e) {
      setError(e.message);
      setStatus("");
    }
  }

  async function removeProduct(product) {
    if (
      !window.confirm(
        `Remove "${product.name}" from the user Fund Products page?`
      )
    ) {
      return;
    }

    try {
      setError("");
      setStatus(
        `Removing ${product.name}…`
      );

      const r = await fetch(
        `/api/admin/funds?id=${encodeURIComponent(
          product.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.error ||
            "Unable to remove product."
        );
      }

      if (f.id === product.id) {
        setF(emptyForm);
        setFile(null);
      }

      setStatus(
        `${product.name} removed successfully.`
      );

      await load();
    } catch (e) {
      setError(e.message);
      setStatus("");
    }
  }

  return (
    <main className="mobile-shell scroll-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>Fund Products</h1>

          <p className="muted">
            Products, rates, pictures and maturity
          </p>
        </div>

        <Link
          className="icon-button"
          href="/admin"
        >
          ←
        </Link>
      </header>

      <form
        className="admin-card"
        onSubmit={save}
      >
        <strong>
          {f.id
            ? "Edit Fund Product"
            : "Create Fund"}
        </strong>

        <div className="form-card">
          <label>
            Product name

            <input
              required
              value={f.name}
              onChange={(e) =>
                set(
                  "name",
                  e.target.value
                )
              }
            />
          </label>

          <label>
            Description

            <textarea
              value={f.description}
              onChange={(e) =>
                set(
                  "description",
                  e.target.value
                )
              }
            />
          </label>

          <label>
            Product picture

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setFile(
                  e.target.files?.[0] ||
                    null
                )
              }
            />
          </label>

          {f.imageUrl && (
            <img
              src={f.imageUrl}
              alt=""
              style={{
                width: 100,
                height: 100,
                objectFit: "cover",
                borderRadius: 12,
              }}
            />
          )}

          <div className="setting-grid">
            <label>
              Interest rate %

              <input
                required
                inputMode="decimal"
                value={f.interestRate}
                onChange={(e) =>
                  set(
                    "interestRate",
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Term days

              <input
                required
                inputMode="numeric"
                value={f.termDays}
                onChange={(e) =>
                  set(
                    "termDays",
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Minimum amount

              <input
                required
                inputMode="decimal"
                value={
                  f.minimumAmount
                }
                onChange={(e) =>
                  set(
                    "minimumAmount",
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Maximum amount

              <input
                inputMode="decimal"
                value={
                  f.maximumAmount
                }
                onChange={(e) =>
                  set(
                    "maximumAmount",
                    e.target.value
                  )
                }
              />
            </label>
          </div>

          <label>
            Display order

            <input
              inputMode="numeric"
              value={f.displayOrder}
              onChange={(e) =>
                set(
                  "displayOrder",
                  e.target.value
                )
              }
            />
          </label>

          <label>
            Active

            <input
              type="checkbox"
              checked={f.active}
              onChange={(e) =>
                set(
                  "active",
                  e.target.checked
                )
              }
            />
          </label>

          <button
            className="primary-button"
            type="submit"
          >
            {f.id
              ? "Update Product"
              : "Save Product"}
          </button>

          {f.id && (
            <button
              type="button"
              className="secondary-button"
              onClick={cancelEdit}
            >
              Cancel Edit
            </button>
          )}

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
        </div>
      </form>

      <section className="admin-card">
        <div className="admin-card-head">
          <strong>Products</strong>

          <span className="badge">
            {rows.length}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="muted">
            No fund products found.
          </p>
        ) : (
          rows.map((p) => (
            <div
              className="list-row"
              key={p.id}
              style={{
                alignItems: "center",
                gap: 12,
              }}
            >
              {p.image_url && (
                <img
                  src={p.image_url}
                  alt=""
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: 10,
                  }}
                />
              )}

              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <strong>
                  {p.name}
                </strong>

                <span className="muted">
                  {p.interest_rate}% ·{" "}
                  {p.period_days} days
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    editProduct(p)
                  }
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    removeProduct(p)
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
