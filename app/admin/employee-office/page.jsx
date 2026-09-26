"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const EMPTY_FORM = {
  name: "",
  location: "",
  description: "",
  imageUrl: "",
  displayOrder: 0,
  active: true
};

export default function OfficeAdmin() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [branches, setBranches] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadBranches() {
    try {
      const response = await fetch(
        "/api/admin/branches",
        {
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load branches."
        );
      }

      setBranches(data.branches || []);

    } catch (err) {
      setError(
        err.message || "Unable to load branches."
      );
    }
  }

  useEffect(() => {
    loadBranches();
  }, []);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setFile(null);
    setEditingId(null);
    setMessage("");
    setError("");
  }

  async function uploadImage() {
    if (!file) {
      return form.imageUrl;
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("folder", "branches");

    const response = await fetch(
      "/api/admin/media",
      {
        method: "POST",
        body: formData
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to upload branch image."
      );
    }

    return data.url;
  }

  async function saveBranch() {
    setMessage("");
    setError("");

    const name = String(form.name || "").trim();

    if (!name) {
      setError("Please enter the branch name.");
      return;
    }

    setSaving(true);

    try {
      const imageUrl = await uploadImage();

      const payload = {
        name,
        location: String(
          form.location || ""
        ).trim(),

        description: String(
          form.description || ""
        ).trim(),

        imageUrl: imageUrl || "",

        displayOrder: Number(
          form.displayOrder || 0
        ),

        active: Boolean(form.active)
      };

      const response = await fetch(
        "/api/admin/branches",
        {
          method: editingId ? "PUT" : "POST",

          headers: {
            "content-type":
              "application/json"
          },

          body: JSON.stringify({
            ...payload,
            id: editingId
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to save branch."
        );
      }

      setMessage(
        editingId
          ? "Branch updated successfully."
          : "Branch saved successfully and is now available to users."
      );

      setForm(EMPTY_FORM);
      setFile(null);
      setEditingId(null);

      await loadBranches();

    } catch (err) {
      setError(
        err.message || "Unable to save branch."
      );

    } finally {
      setSaving(false);
    }
  }

  function editBranch(branch) {
    setMessage("");
    setError("");
    setFile(null);

    setEditingId(branch.id);

    setForm({
      name: branch.name || "",
      location: branch.location || "",
      description:
        branch.description || "",
      imageUrl:
        branch.image_url || "",
      displayOrder:
        Number(branch.display_order || 0),
      active:
        branch.active !== false
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function deleteBranch(branch) {
    const confirmed = window.confirm(
      `Delete "${branch.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/admin/branches?id=${encodeURIComponent(
          branch.id
        )}`,
        {
          method: "DELETE"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to delete branch."
        );
      }

      setMessage(
        `"${branch.name}" was deleted successfully.`
      );

      if (editingId === branch.id) {
        resetForm();
      }

      await loadBranches();

    } catch (err) {
      setError(
        err.message || "Unable to delete branch."
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
            Employee Office
          </h1>

          <p className="muted">
            Manage Global Nexus Capital branches.
          </p>

        </div>

        <Link
          className="icon-button"
          href="/admin"
        >
          ←
        </Link>

      </header>


      <section className="admin-card">

        <strong>
          {editingId
            ? "Edit Branch"
            : "Add Branch"}
        </strong>

        <div className="form-card">

          <label>
            Branch name

            <input
              value={form.name}
              onChange={(event) =>
                updateField(
                  "name",
                  event.target.value
                )
              }
            />

          </label>


          <label>
            Location

            <input
              value={form.location}
              onChange={(event) =>
                updateField(
                  "location",
                  event.target.value
                )
              }
            />

          </label>


          <label>
            Description

            <textarea
              value={form.description}
              onChange={(event) =>
                updateField(
                  "description",
                  event.target.value
                )
              }
            />

          </label>


          <label>
            Display order

            <input
              type="number"
              value={form.displayOrder}
              onChange={(event) =>
                updateField(
                  "displayOrder",
                  event.target.value
                )
              }
            />

          </label>


          <label>
            Branch image

            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                setFile(
                  event.target.files?.[0] ||
                  null
                )
              }
            />

          </label>


          {form.imageUrl && (
            <div>

              <p className="muted">
                Current branch image
              </p>

              <img
                src={form.imageUrl}
                alt="Current branch"
                style={{
                  width: "100%",
                  borderRadius: 14,
                  marginTop: 6,
                  maxHeight: 220,
                  objectFit: "cover"
                }}
              />

            </div>
          )}


          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10
            }}
          >

            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                updateField(
                  "active",
                  event.target.checked
                )
              }
            />

            Branch is active and visible to users

          </label>


          {error && (
            <p className="auth-error">
              {error}
            </p>
          )}

          {message && (
            <p className="muted">
              {message}
            </p>
          )}


          <button
            type="button"
            className="primary-button"
            onClick={saveBranch}
            disabled={saving}
          >

            {saving
              ? "Saving..."
              : editingId
              ? "Update Branch"
              : "Save Branch"}

          </button>


          {editingId && (

            <button
              type="button"
              className="secondary-button"
              onClick={resetForm}
            >
              Cancel Editing
            </button>

          )}

        </div>

      </section>


      <section className="admin-card">

        <strong>
          Branches
        </strong>


        {!branches.length && (

          <p className="muted">
            No branches have been added yet.
          </p>

        )}


        {branches.map((branch) => (

          <div
            className="list-row"
            key={branch.id}
            style={{
              alignItems: "flex-start",
              gap: 12
            }}
          >

            <div
              style={{
                flex: 1,
                minWidth: 0
              }}
            >

              {branch.image_url && (

                <img
                  src={branch.image_url}
                  alt={branch.name}
                  style={{
                    width: "100%",
                    maxHeight: 150,
                    objectFit: "cover",
                    borderRadius: 12,
                    marginBottom: 10
                  }}
                />

              )}

              <strong>
                {branch.name}
              </strong>

              <p className="muted">
                {branch.location ||
                  "No location"}
              </p>


              {branch.description && (

                <p className="muted">
                  {branch.description}
                </p>

              )}


              <p
                className="muted"
                style={{
                  fontSize: 11
                }}
              >
                Display order:{" "}
                {branch.display_order || 0}
              </p>

            </div>


            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "stretch"
              }}
            >

              <span className="badge">

                {branch.active
                  ? "Active"
                  : "Hidden"}

              </span>


              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  editBranch(branch)
                }
              >
                Edit
              </button>


              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  deleteBranch(branch)
                }
              >
                Delete
              </button>

            </div>

          </div>

        ))}

      </section>

    </main>
  );
}
