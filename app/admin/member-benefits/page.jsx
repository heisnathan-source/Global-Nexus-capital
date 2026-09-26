"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const emptyForm = {
  name: "",
  description: "",
  rankName: "",
  imageUrl: "",
  displayOrder: 0,
  active: true,
};

export default function AdminMemberBenefits() {
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);

  const [benefits, setBenefits] = useState([]);
  const [ranks, setRanks] = useState([]);

  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  async function load() {
    try {
      setLoading(true);

      const [benefitsResponse, ranksResponse] =
        await Promise.all([
          fetch("/api/admin/member-benefits", {
            credentials: "include",
            cache: "no-store",
          }),
          fetch("/api/admin/ranks", {
            credentials: "include",
            cache: "no-store",
          }),
        ]);

      const benefitsData =
        await benefitsResponse.json();

      const ranksData =
        await ranksResponse.json();

      if (!benefitsResponse.ok) {
        throw new Error(
          benefitsData?.error ||
          "Could not load member benefits."
        );
      }

      if (!ranksResponse.ok) {
        throw new Error(
          ranksData?.error ||
          "Could not load ranks."
        );
      }

      setBenefits(
        benefitsData.benefits || []
      );

      setRanks(
        ranksData.ranks || []
      );

    } catch (error) {

      setMessage(
        error.message ||
        "Could not load member benefits."
      );

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);


  function updateForm(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }


  async function uploadImage() {
    if (!file) {
      return form.imageUrl || "";
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append(
      "folder",
      "member-benefits"
    );

    const response = await fetch(
      "/api/admin/media",
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "Could not upload benefit image."
      );
    }

    if (!data?.url) {
      throw new Error(
        "Image upload did not return an image URL."
      );
    }

    return data.url;
  }


  async function saveBenefit() {
    if (!form.name.trim()) {
      setMessage(
        "Please enter a benefit name."
      );
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const imageUrl =
        await uploadImage();

      const body = {
        ...form,
        name: form.name.trim(),
        description:
          form.description.trim(),
        imageUrl,
        displayOrder:
          Number(form.displayOrder || 0),
      };

      if (editingId) {
        body.id = editingId;
      }

      const response = await fetch(
        "/api/admin/member-benefits",
        {
          method:
            editingId ? "PUT" : "POST",

          credentials: "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(body),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Could not save benefit."
        );
      }

      setMessage(
        editingId
          ? "Benefit updated successfully."
          : "Benefit saved successfully."
      );

      setForm(emptyForm);
      setFile(null);
      setEditingId(null);

      const fileInput =
        document.getElementById(
          "benefit-image"
        );

      if (fileInput) {
        fileInput.value = "";
      }

      await load();

    } catch (error) {

      setMessage(
        error.message ||
        "Could not save benefit."
      );

    } finally {

      setSaving(false);
    }
  }


  function editBenefit(benefit) {
    setEditingId(benefit.id);

    setForm({
      name: benefit.name || "",
      description:
        benefit.description || "",
      rankName:
        benefit.rank_name || "",
      imageUrl:
        benefit.image_url || "",
      displayOrder:
        Number(
          benefit.display_order || 0
        ),
      active:
        benefit.active !== false,
    });

    setFile(null);

    setMessage(
      `Editing "${benefit.name}". Make your changes and press Update Benefit.`
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  function cancelEdit() {
    setEditingId(null);

    setForm(emptyForm);
    setFile(null);

    const fileInput =
      document.getElementById(
        "benefit-image"
      );

    if (fileInput) {
      fileInput.value = "";
    }

    setMessage("Edit cancelled.");
  }


  async function deleteBenefit(id, name) {
    const confirmed =
      window.confirm(
        `Delete "${name}" permanently?`
      );

    if (!confirmed) return;

    try {
      setMessage("");

      const response = await fetch(
        `/api/admin/member-benefits?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Could not delete benefit."
        );
      }

      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
        setFile(null);
      }

      setMessage(
        `"${name}" was deleted successfully.`
      );

      await load();

    } catch (error) {

      setMessage(
        error.message ||
        "Could not delete benefit."
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
            Member Benefits
          </h1>

          <p className="muted">
            Create and manage member benefits
          </p>

        </div>


        <Link
          className="icon-button"
          href="/admin"
          aria-label="Back to dashboard"
        >
          ←
        </Link>

      </header>


      {message && (

        <div className="message-box">

          {message}

        </div>

      )}


      <section className="admin-card">

        <div className="admin-card-head">

          <div>

            <strong>
              {editingId
                ? "Edit Benefit"
                : "Add Benefit"}
            </strong>

            <p className="muted">
              {editingId
                ? "Update the selected member benefit."
                : "Create a benefit for members or specific ranks."}
            </p>

          </div>

          {editingId && (

            <span className="badge">
              Editing
            </span>

          )}

        </div>


        <div className="form-card">

          <label>

            Benefit name

            <input
              value={form.name}
              onChange={(event) =>
                updateForm(
                  "name",
                  event.target.value
                )
              }
              placeholder="Enter benefit name"
            />

          </label>


          <label>

            Description

            <textarea
              value={form.description}
              onChange={(event) =>
                updateForm(
                  "description",
                  event.target.value
                )
              }
              placeholder="Describe this benefit"
            />

          </label>


          <label>

            Rank

            <select
              value={form.rankName}
              onChange={(event) =>
                updateForm(
                  "rankName",
                  event.target.value
                )
              }
            >

              <option value="">
                All ranks
              </option>

              {ranks.map((rank) => (

                <option
                  key={rank.id}
                  value={rank.name}
                >
                  {rank.name}
                </option>

              ))}

            </select>

          </label>


          <label>

            Benefit image

            <input
              id="benefit-image"
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

            <div
              style={{
                borderRadius: 14,
                overflow: "hidden",
                background: "#f5f8fc",
              }}
            >

              <img
                src={form.imageUrl}
                alt="Current benefit"
                style={{
                  width: "100%",
                  height: 150,
                  objectFit: "cover",
                  display: "block",
                }}
              />

            </div>

          )}


          <label>

            Display order

            <input
              type="number"
              inputMode="numeric"
              value={form.displayOrder}
              onChange={(event) =>
                updateForm(
                  "displayOrder",
                  event.target.value
                )
              }
            />

          </label>


          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >

            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                updateForm(
                  "active",
                  event.target.checked
                )
              }
              style={{
                width: "auto",
              }}
            />

            Active and visible to users

          </label>


          <button
            type="button"
            className="primary-button"
            onClick={saveBenefit}
            disabled={saving}
          >

            {saving
              ? "Saving..."
              : editingId
                ? "Update Benefit"
                : "Save Benefit"}

          </button>


          {editingId && (

            <button
              type="button"
              className="small-button"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel Edit
            </button>

          )}

        </div>

      </section>


      <section className="admin-card">

        <div className="admin-card-head">

          <div>

            <strong>
              Saved Benefits
            </strong>

            <p className="muted">
              {loading
                ? "Loading benefits..."
                : `${benefits.length} benefit${benefits.length === 1 ? "" : "s"} saved`}
            </p>

          </div>

        </div>


        {!loading &&
          benefits.length === 0 && (

          <p className="muted">
            No member benefits have been added yet.
          </p>

        )}


        {benefits.map((benefit) => (

          <div
            className="admin-row"
            key={benefit.id}
            style={{
              marginBottom: 10,
              alignItems: "flex-start",
            }}
          >

            <div
              style={{
                flex: 1,
              }}
            >

              <strong>
                {benefit.name}
              </strong>

              {benefit.description && (

                <span>
                  {benefit.description}
                </span>

              )}

              <span>
                Rank:{" "}
                {benefit.rank_name ||
                  "All ranks"}
              </span>

              <span>
                Display order:{" "}
                {benefit.display_order || 0}
              </span>

              <span
                className={
                  benefit.active
                    ? "status-on"
                    : ""
                }
              >
                {benefit.active
                  ? "Active"
                  : "Hidden"}
              </span>

            </div>


            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 7,
              }}
            >

              <button
                type="button"
                className="small-button"
                onClick={() =>
                  editBenefit(benefit)
                }
              >
                Edit
              </button>


              <button
                type="button"
                className="small-button"
                onClick={() =>
                  deleteBenefit(
                    benefit.id,
                    benefit.name
                  )
                }
                style={{
                  color: "#b42318",
                  background: "#fff0ef",
                }}
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
