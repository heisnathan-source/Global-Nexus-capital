"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function getRankColor(rankName) {
  const rank = String(rankName || "").toLowerCase();

  if (rank.includes("starter")) {
    return {
      background:
        "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)"
    };
  }

  if (rank.includes("growth")) {
    return {
      background:
        "linear-gradient(135deg, #059669 0%, #10b981 100%)"
    };
  }

  if (rank.includes("super")) {
    return {
      background:
        "linear-gradient(135deg, #0891b2 0%, #14b8a6 100%)"
    };
  }

  if (rank.includes("elite")) {
    return {
      background:
        "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)"
    };
  }

  if (rank.includes("premier")) {
    return {
      background:
        "linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)"
    };
  }

  if (rank.includes("premium")) {
    return {
      background:
        "linear-gradient(135deg, #be123c 0%, #f43f5e 100%)"
    };
  }

  if (rank.includes("legacy")) {
    return {
      background:
        "linear-gradient(135deg, #374151 0%, #111827 100%)"
    };
  }

  return {
    background:
      "linear-gradient(135deg, #475569 0%, #64748b 100%)"
  };
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);

  const [selected, setSelected] =
    useState({});

  const [started, setStarted] =
    useState({});

  const [results, setResults] =
    useState({});

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState({});

  const [error, setError] =
    useState("");

  async function loadTasks() {
    try {
      setLoading(true);
      setError("");

      const r =
        await fetch(
          "/api/tasks",
          {
            cache: "no-store"
          }
        );

      const d =
        await r.json();

      if (!r.ok) {
        throw new Error(
          d.error ||
          "Unable to load tasks."
        );
      }

      setTasks(d.tasks || []);

    } catch (e) {

      setError(
        e.message ||
        "Unable to load tasks."
      );

    } finally {

      setLoading(false);

    }
  }

  useEffect(() => {
    loadTasks();
  }, []);


  function startAnswering(taskId) {

    setStarted((current) => ({
      ...current,
      [taskId]: true
    }));

    setError("");
  }


  function selectAnswer(
    taskId,
    answer
  ) {

    setSelected((current) => ({
      ...current,
      [taskId]: answer
    }));

    setError("");
  }


  async function submit(task) {

    const answer =
      selected[task.id];

    if (!answer) {

      setError(
        "Please select an answer first."
      );

      return;
    }

    setError("");

    setSubmitting((current) => ({
      ...current,
      [task.id]: true
    }));

    try {

      const r =
        await fetch(
          "/api/tasks",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json"
            },

            body: JSON.stringify({
              taskId: task.id,
              answer
            })
          }
        );

      const d =
        await r.json();

      if (!r.ok) {
        throw new Error(
          d.error ||
          "Unable to submit task."
        );
      }


      /*
      ==========================================
      SHOW RESULT TEMPORARILY
      ==========================================
      */

      setResults((current) => ({
        ...current,
        [task.id]: d.submission
      }));


      /*
      ==========================================
      WAIT SO USER CAN SEE RESULT
      ==========================================
      */

      await new Promise(
        (resolve) =>
          setTimeout(resolve, 1200)
      );


      /*
      ==========================================
      CLEAR OLD TASK STATE
      ==========================================

      This is the important part.

      The task may still have another
      display available.

      Example:

      Forex Display 1 → Correct

      After the result is shown,
      remove the old result state.

      When tasks reload, Forex can now
      appear as Display 2.
      */

      setResults((current) => {
        const next = {
          ...current
        };

        delete next[task.id];

        return next;
      });


      setStarted((current) => {
        const next = {
          ...current
        };

        delete next[task.id];

        return next;
      });


      setSelected((current) => {
        const next = {
          ...current
        };

        delete next[task.id];

        return next;
      });


      /*
      ==========================================
      RELOAD AVAILABLE TASKS
      ==========================================

      The backend will now calculate:

      - Which tasks still have displays
      - Which display number comes next
      - Whether the rank limit is reached
      */

      await loadTasks();

    } catch (e) {

      setError(
        e.message ||
        "Unable to submit task."
      );

    } finally {

      setSubmitting((current) => ({
        ...current,
        [task.id]: false
      }));

    }
  }


  if (loading) {

    return (
      <main className="mobile-shell scroll-page">

        <header className="topbar">

          <div>

            <div className="eyebrow">
              Global Nexus Capital
            </div>

            <h1>
              Tasks
            </h1>

          </div>


          <Link
            className="icon-button"
            href="/"
          >
            ←
          </Link>

        </header>


        <section className="admin-card">

          <p className="muted">
            Loading your tasks...
          </p>

        </section>

      </main>
    );
  }


  return (
    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>

          <div className="eyebrow">
            Global Nexus Capital
          </div>

          <h1>
            Tasks
          </h1>

          <p className="muted">
            Choose and complete your
            available tasks
          </p>

        </div>


        <Link
          className="icon-button"
          href="/"
        >
          ←
        </Link>

      </header>


      {error && (

        <section className="admin-card">

          <p className="auth-error">
            {error}
          </p>

        </section>

      )}


      {tasks.length === 0 ? (

        <section className="admin-card">

          <strong>
            Available Tasks
          </strong>


          <div className="empty-document">

            <span>
              No active tasks are currently
              available for your rank.
            </span>

          </div>

        </section>

      ) : (

        <section>

          {tasks.map((task) => {

            const result =
              results[task.id];

            const options =
              Array.isArray(task.options)
                ? task.options
                : [];

            const isStarted =
              started[task.id] === true;

            const selectedAnswer =
              selected[task.id];

            const isSubmitting =
              submitting[task.id] === true;

            const rankStyle =
              getRankColor(
                task.rank_name
              );


            return (

              <article
                className="admin-card"
                key={task.id}
              >

                <strong>
                  {task.title}
                </strong>


                {task.display_number && (

                  <p
                    className="muted"
                    style={{
                      marginTop: "6px"
                    }}
                  >

                    Display{" "}

                    {task.display_number}

                    {" "}of{" "}

                    {task.display_limit || 1}

                  </p>

                )}


                {task.image_url && (

                  <img
                    src={task.image_url}
                    alt={task.title}
                    style={{
                      width: "100%",
                      borderRadius: "12px",
                      marginTop: "12px",
                      display: "block"
                    }}
                  />

                )}


                {task.description && (

                  <p className="muted">
                    {task.description}
                  </p>

                )}


                {task.rank_name && (

                  <div
                    style={{
                      ...rankStyle,
                      color: "#fff",
                      borderRadius: "16px",
                      padding: "18px",
                      marginTop: "14px",
                      marginBottom: "16px",
                      boxShadow:
                        "0 8px 24px rgba(0,0,0,0.12)"
                    }}
                  >

                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        opacity: 0.9,
                        marginBottom: "5px"
                      }}
                    >
                      Your current rank
                    </div>


                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: 800
                      }}
                    >
                      Rank:{" "}

                      {task.rank_name}
                    </div>

                  </div>

                )}


                <div className="form-card">

                  <strong>
                    {task.question}
                  </strong>


                  {!result &&
                    !isStarted && (

                    <button
                      type="button"
                      className="primary-button"
                      style={{
                        marginTop: "18px",
                        width: "100%"
                      }}
                      onClick={() =>
                        startAnswering(
                          task.id
                        )
                      }
                    >
                      START ANSWERING
                    </button>

                  )}


                  {!result &&
                    isStarted && (

                    <>

                      <div
                        className="answer-list"
                        style={{
                          marginTop: "18px"
                        }}
                      >

                        {options.length > 0 ? (

                          options.map(
                            (option, index) => {

                              const isSelected =
                                selectedAnswer ===
                                option.text;

                              return (

                                <button
                                  type="button"

                                  key={
                                    option.id ||
                                    `${task.id}-${index}`
                                  }

                                  disabled={
                                    isSubmitting
                                  }

                                  onClick={() =>
                                    selectAnswer(
                                      task.id,
                                      option.text
                                    )
                                  }

                                  className={
                                    isSelected
                                      ? "primary-button"
                                      : "secondary-button"
                                  }

                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    marginBottom:
                                      "10px"
                                  }}
                                >

                                  {option.text}

                                </button>

                              );
                            }
                          )

                        ) : (

                          <p className="muted">

                            No answer choices are
                            available for this task.

                          </p>

                        )}

                      </div>


                      <button
                        type="button"
                        className="primary-button"

                        disabled={
                          !selectedAnswer ||
                          isSubmitting
                        }

                        onClick={() =>
                          submit(task)
                        }

                        style={{
                          width: "100%",
                          marginTop: "8px"
                        }}
                      >

                        {isSubmitting
                          ? "SUBMITTING..."
                          : "SUBMIT ANSWER"}

                      </button>

                    </>

                  )}


                  {result && (

                    <div
                      className="empty-document"
                      style={{
                        marginTop: "16px"
                      }}
                    >

                      {result.correct ? (

                        <div>

                          <strong>
                            ✓ Correct
                          </strong>


                          <p
                            className="muted"
                            style={{
                              marginBottom: 0
                            }}
                          >

                            GHS{" "}

                            {Number(
                              result.commission || 0
                            ).toLocaleString(
                              "en-GH",
                              {
                                minimumFractionDigits:
                                  2,

                                maximumFractionDigits:
                                  2
                              }
                            )}

                            {" "}earned

                          </p>

                        </div>

                      ) : (

                        <div>

                          <strong>
                            ✕ Incorrect
                          </strong>


                          <p
                            className="muted"
                            style={{
                              marginBottom: 0
                            }}
                          >

                            Loading your next
                            available display...

                          </p>

                        </div>

                      )}

                    </div>

                  )}

                </div>

              </article>

            );

          })}

        </section>

      )}

    </main>
  );
}
