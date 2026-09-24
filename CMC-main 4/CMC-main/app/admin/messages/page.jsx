"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const emptyForm = {
  title: "",
  body: "",
  publishAt: "",
  expiresAt: "",
  active: true,
  imageUrl: ""
};

function formatDateForInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) =>
    String(number).padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

export default function MessagesAdmin() {

  const [form, setForm] =
    useState(emptyForm);

  const [file, setFile] =
    useState(null);

  const [rows, setRows] =
    useState([]);

  const [status, setStatus] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [editingId, setEditingId] =
    useState(null);

  const [removingId, setRemovingId] =
    useState(null);


  async function load() {

    try {

      setError("");

      const response =
        await fetch(
          "/api/admin/messages",
          {
            cache: "no-store"
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to load messages."
        );
      }

      setRows(data.messages || []);

    } catch (err) {

      setError(
        err.message ||
        "Unable to load messages."
      );

    }
  }


  useEffect(() => {
    load();
  }, []);


  function setField(key, value) {

    setForm((current) => ({
      ...current,
      [key]: value
    }));

  }


  function startEdit(message) {

    setStatus("");
    setError("");

    setEditingId(message.id);

    setFile(null);

    setForm({
      title: message.title || "",
      body: message.body || "",
      publishAt:
        formatDateForInput(
          message.publish_at
        ),
      expiresAt:
        formatDateForInput(
          message.expires_at
        ),
      active:
        message.active !== false,
      imageUrl:
        message.image_url || ""
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }


  function cancelEdit() {

    setEditingId(null);

    setFile(null);

    setForm(emptyForm);

    setStatus("");

    setError("");

  }


  async function uploadImage() {

    if (!file) {
      return form.imageUrl || "";
    }

    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    formData.append(
      "folder",
      "messages"
    );

    const response =
      await fetch(
        "/api/admin/media",
        {
          method: "POST",
          body: formData
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Unable to upload image."
      );
    }

    return data.url;

  }


  async function save(event) {

    event.preventDefault();

    try {

      setLoading(true);

      setStatus("");

      setError("");

      const imageUrl =
        await uploadImage();

      const payload = {
        ...form,
        imageUrl
      };

      let response;

      if (editingId) {

        response =
          await fetch(
            "/api/admin/messages",
            {
              method: "PUT",

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

      } else {

        response =
          await fetch(
            "/api/admin/messages",
            {
              method: "POST",

              headers: {
                "content-type":
                  "application/json"
              },

              body: JSON.stringify(
                payload
              )
            }
          );

      }


      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to save message."
        );
      }


      setStatus(
        editingId
          ? "Message updated successfully."
          : "Message published successfully."
      );

      setEditingId(null);

      setFile(null);

      setForm(emptyForm);

      await load();

    } catch (err) {

      setError(
        err.message ||
        "Unable to save message."
      );

      setStatus("");

    } finally {

      setLoading(false);

    }

  }


  async function removeMessage(message) {

    const confirmed =
      window.confirm(
        `Remove "${message.title}"? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {

      setRemovingId(message.id);

      setStatus("");

      setError("");

      const response =
        await fetch(
          "/api/admin/messages",
          {
            method: "DELETE",

            headers: {
              "content-type":
                "application/json"
            },

            body: JSON.stringify({
              id: message.id
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to remove message."
        );
      }


      if (editingId === message.id) {
        cancelEdit();
      }

      setStatus(
        "Message removed successfully."
      );

      await load();

    } catch (err) {

      setError(
        err.message ||
        "Unable to remove message."
      );

    } finally {

      setRemovingId(null);

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
            Messages
          </h1>

          <p className="muted">
            Publish and manage official Global Nexus Capital information.
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

        <div className="admin-card-head">

          <strong>

            {editingId
              ? "Edit Message"
              : "Create Message"}

          </strong>


          {editingId && (

            <span className="badge">
              Editing
            </span>

          )}

        </div>


        <div className="form-card">

          <label>

            Title

            <input
              required
              value={form.title}
              onChange={(event) =>
                setField(
                  "title",
                  event.target.value
                )
              }
            />

          </label>


          <label>

            Message

            <textarea
              required
              value={form.body}
              onChange={(event) =>
                setField(
                  "body",
                  event.target.value
                )
              }
            />

          </label>


          <label>

            Image (optional)

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

            <div className="admin-card">

              <strong>
                Current Image
              </strong>

              <img
                src={form.imageUrl}
                alt="Current message"
                style={{
                  width: "100%",
                  marginTop: 12,
                  borderRadius: 12
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setField(
                    "imageUrl",
                    ""
                  )
                }
              >
                Remove Image
              </button>

            </div>

          )}


          <div className="setting-grid">

            <label>

              Publish at

              <input
                type="datetime-local"
                value={form.publishAt}
                onChange={(event) =>
                  setField(
                    "publishAt",
                    event.target.value
                  )
                }
              />

            </label>


            <label>

              Expires at

              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) =>
                  setField(
                    "expiresAt",
                    event.target.value
                  )
                }
              />

            </label>

          </div>


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
                setField(
                  "active",
                  event.target.checked
                )
              }
            />

            Published and visible to users

          </label>


          <div className="admin-actions">

            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >

              {loading
                ? "Saving…"
                : editingId
                  ? "Save Changes"
                  : "Publish Message"}

            </button>


            {editingId && (

              <button
                type="button"
                onClick={cancelEdit}
                disabled={loading}
              >
                Cancel Edit
              </button>

            )}

          </div>


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

          <strong>
            Messages
          </strong>

          <span className="badge">
            {rows.length}
          </span>

        </div>


        {!rows.length ? (

          <div className="empty-document">

            <span>
              No messages have been created yet.
            </span>

          </div>

        ) : (

          rows.map((message) => (

            <div
              className="list-row"
              key={message.id}
              style={{
                alignItems: "flex-start",
                gap: 12
              }}
            >

              <div
                style={{
                  flex: 1
                }}
              >

                <strong>
                  {message.title}
                </strong>


                <span className="muted">

                  {message.active
                    ? "Published"
                    : "Draft"}

                </span>


                <p
                  className="muted"
                  style={{
                    marginTop: 8,
                    whiteSpace:
                      "pre-wrap"
                  }}
                >

                  {message.body}

                </p>


                {message.image_url && (

                  <img
                    src={message.image_url}
                    alt={message.title}
                    style={{
                      width: "100%",
                      maxWidth: 260,
                      borderRadius: 12,
                      marginTop: 8
                    }}
                  />

                )}

              </div>


              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8
                }}
              >

                <button
                  type="button"
                  onClick={() =>
                    startEdit(message)
                  }
                  disabled={
                    removingId === message.id
                  }
                >
                  Edit
                </button>


                <button
                  type="button"
                  onClick={() =>
                    removeMessage(message)
                  }
                  disabled={
                    removingId === message.id
                  }
                >

                  {removingId === message.id
                    ? "Removing…"
                    : "Remove"}

                </button>

              </div>

            </div>

          ))

        )}

      </section>

    </main>

  );

}
