"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Message() {
  const [rows, setRows] = useState([]);
  const [selectedMessage, setSelectedMessage] =
    useState(null);

  useEffect(() => {
    fetch("/api/messages")
      .then((r) => r.json())
      .then((d) =>
        setRows(
          Array.isArray(d.messages)
            ? d.messages
            : []
        )
      )
      .catch(() => {});
  }, []);

  async function read(id) {
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messageId: id,
        }),
      });
    } catch {}

    setRows((current) =>
      current.map((message) =>
        message.id === id
          ? {
              ...message,
              read_at:
                new Date().toISOString(),
            }
          : message
      )
    );
  }

  function openMessage(message) {
    setSelectedMessage(message);
    read(message.id);
  }

  function closeMessage() {
    setSelectedMessage(null);
  }

  return (
    <main className="mobile-shell scroll-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">Global Nexus Capital</div>
          <h1>
            {selectedMessage
              ? "Message"
              : "Messages"}
          </h1>

          <p className="muted">
            {selectedMessage
              ? "Official Global Nexus Capital message"
              : "Official Global Nexus Capital messages"}
          </p>
        </div>

        {selectedMessage ? (
          <button
            type="button"
            className="icon-button"
            onClick={closeMessage}
            aria-label="Back to messages"
          >
            ←
          </button>
        ) : (
          <Link
            className="icon-button"
            href="/"
            aria-label="Back to home"
          >
            ←
          </Link>
        )}
      </header>

      {selectedMessage ? (
        <section
          className="admin-card"
          style={{
            padding: 18,
          }}
        >
          <div
            className="admin-card-head"
            style={{
              marginBottom: 18,
            }}
          >
            <strong>
              {selectedMessage.title}
            </strong>

            <span className="badge">
              Official
            </span>
          </div>

          {selectedMessage.image_url ? (
            <div
              style={{
                width: "100%",
                marginBottom: 20,
                borderRadius: 16,
                overflow: "hidden",
                background: "#f3f6fb",
              }}
            >
              <img
                src={selectedMessage.image_url}
                alt={selectedMessage.title || "Global Nexus Capital message"}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight: "none",
                  objectFit: "contain",
                }}
              />
            </div>
          ) : null}

          <div
            style={{
              padding: "4px 2px 12px",
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 22,
                lineHeight: 1.3,
                color: "#17233d",
              }}
            >
              {selectedMessage.title}
            </h2>

            <div
              style={{
                fontSize: 16,
                lineHeight: 1.7,
                color: "#66738a",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {selectedMessage.body}
            </div>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={closeMessage}
            style={{
              width: "100%",
              marginTop: 8,
            }}
          >
            Back to Messages
          </button>
        </section>
      ) : (
        <section className="admin-card">
          <div className="admin-card-head">
            <strong>Messages</strong>

            <span className="badge">
              Official
            </span>
          </div>

          {rows.length ? (
            rows.map((message) => (
              <article
                className="list-row"
                key={message.id}
                onClick={() =>
                  openMessage(message)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    openMessage(message);
                  }
                }}
                style={{
                  cursor: "pointer",
                }}
              >
                {message.image_url ? (
                  <img
                    src={message.image_url}
                    alt=""
                    style={{
                      width: 72,
                      height: 72,
                      objectFit: "cover",
                      borderRadius: 12,
                      flexShrink: 0,
                    }}
                  />
                ) : null}

                <div
                  style={{
                    minWidth: 0,
                  }}
                >
                  <strong>
                    {message.title}
                  </strong>

                  <span className="muted">
                    {message.body}
                  </span>

                  <span className="muted">
                    {message.read_at
                      ? "Read"
                      : "Unread"}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-document">
              <span>
                Admin messages will appear here.
              </span>
            </div>
          )}
        </section>
      )}

      {!selectedMessage ? (
        <nav className="bottom-nav">
          <Link href="/">Home</Link>
          <Link href="/tasks">Task</Link>
          <Link
            className="active"
            href="/message"
          >
            Message
          </Link>
          <Link href="/rank">Rank</Link>
          <Link href="/mine">Mine</Link>
        </nav>
      ) : null}
    </main>
  );
}
