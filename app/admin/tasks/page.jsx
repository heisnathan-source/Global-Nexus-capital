"use client";

import {
  useEffect,
  useState
} from "react";

import Link from "next/link";

import styles from "./page.module.css";


const emptyForm = {
  title: "",
  description: "",
  question: "",
  commission: "",
  rankId: "",
  displayOrder: "1",
  displayLimit: "1",
  active: true,
  imageUrl: ""
};


const defaultOptions = [
  {
    text: "",
    isCorrect: true
  },
  {
    text: "",
    isCorrect: false
  },
  {
    text: "",
    isCorrect: false
  },
  {
    text: "",
    isCorrect: false
  }
];


export default function TaskAdmin() {

  const [f, setF] =
    useState(emptyForm);


  const [options, setOptions] =
    useState(defaultOptions);


  const [
    editingTaskId,
    setEditingTaskId
  ] = useState(null);


  const [image, setImage] =
    useState(null);


  const [ranks, setRanks] =
    useState([]);


  const [rows, setRows] =
    useState([]);


  const [status, setStatus] =
    useState("");


  const [error, setError] =
    useState("");


  const [
    uploading,
    setUploading
  ] = useState(false);


  const [
    deletingId,
    setDeletingId
  ] = useState(null);


  /*
  ==============================================
  LOAD TASKS
  ==============================================
  */

  async function load() {

    try {

      setError("");


      const r =
        await fetch(
          "/api/admin/tasks",
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


      setRows(
        d.tasks || []
      );

    } catch (e) {

      setError(
        e.message ||
        "Unable to load tasks."
      );

    }
  }


  /*
  ==============================================
  INITIAL LOAD
  ==============================================
  */

  useEffect(() => {

    load();


    fetch(
      "/api/admin/ranks"
    )
      .then(
        (r) => r.json()
      )
      .then(
        (d) => {
          setRanks(
            d.ranks || []
          );
        }
      )
      .catch(() => {});

  }, []);


  /*
  ==============================================
  UPDATE FORM FIELD
  ==============================================
  */

  function set(key, value) {

    setF((current) => ({
      ...current,
      [key]: value
    }));

  }


  /*
  ==============================================
  RESET FORM
  ==============================================
  */

  function resetForm() {

    setF(
      emptyForm
    );


    setOptions(
      defaultOptions
    );


    setImage(null);


    setEditingTaskId(null);


    setStatus("");


    setError("");


    const fileInput =
      document.getElementById(
        "task-image"
      );


    if (fileInput) {
      fileInput.value = "";
    }

  }


  /*
  ==============================================
  UPDATE ANSWER
  ==============================================
  */

  function updateOption(
    index,
    value
  ) {

    setOptions(
      (current) =>
        current.map(
          (option, i) =>
            i === index
              ? {
                  ...option,
                  text: value
                }
              : option
        )
    );

  }


  /*
  ==============================================
  MAKE CORRECT ANSWER
  ==============================================
  */

  function makeCorrect(index) {

    setOptions(
      (current) =>
        current.map(
          (option, i) => ({
            ...option,
            isCorrect:
              i === index
          })
        )
    );

  }


  /*
  ==============================================
  ADD ANSWER
  ==============================================
  */

  function addOption() {

    setOptions(
      (current) => [
        ...current,
        {
          text: "",
          isCorrect: false
        }
      ]
    );

  }


  /*
  ==============================================
  REMOVE ANSWER
  ==============================================
  */

  function removeOption(index) {

    if (
      options.length <= 2
    ) {
      setError(
        "A task must have at least 2 answer choices."
      );

      return;
    }


    const removingCorrect =
      options[index].isCorrect;


    setOptions(
      (current) => {

        const next =
          current.filter(
            (_, i) =>
              i !== index
          );


        if (
          removingCorrect &&
          next.length > 0
        ) {
          next[0] = {
            ...next[0],
            isCorrect: true
          };
        }


        return next;

      }
    );


    setError("");

  }


  /*
  ==============================================
  UPLOAD IMAGE
  ==============================================
  */

  async function uploadImage() {

    if (!image) {
      return f.imageUrl;
    }


    setUploading(true);


    setError("");


    try {

      const form =
        new FormData();


      form.append(
        "file",
        image
      );


      const r =
        await fetch(
          "/api/admin/task-image",
          {
            method: "POST",
            body: form
          }
        );


      const d =
        await r.json();


      if (!r.ok) {
        throw new Error(
          d.error ||
          "Image upload failed."
        );
      }


      set(
        "imageUrl",
        d.imageUrl
      );


      return d.imageUrl;

    } catch (e) {

      setError(
        e.message
      );

      throw e;

    } finally {

      setUploading(false);

    }
  }


  /*
  ==============================================
  EDIT TASK
  ==============================================
  */

  function editTask(task) {

    setStatus("");


    setError("");


    setEditingTaskId(
      task.id
    );


    setF({

      title:
        task.title || "",

      description:
        task.description || "",

      question:
        task.question || "",

      commission:
        String(
          task.commission_amount ??
          task.commission_per_task ??
          ""
        ),

      rankId:
        task.rank_id || "",

      displayOrder:
        String(
          task.display_order ?? 1
        ),

      displayLimit:
        String(
          task.display_limit ?? 1
        ),

      active:
        task.active !== false,

      imageUrl:
        task.image_url || ""

    });


    const taskOptions =
      Array.isArray(
        task.options
      )
        ? task.options.map(
            (option) => ({
              text:
                option.text || "",

              isCorrect:
                option.isCorrect === true
            })
          )
        : [];


    if (
      taskOptions.length >= 2
    ) {

      setOptions(
        taskOptions
      );

    } else {

      setOptions([
        {
          text:
            task.correct_answer || "",
          isCorrect: true
        },
        {
          text: "",
          isCorrect: false
        }
      ]);

    }


    setImage(null);


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }


  /*
  ==============================================
  SAVE TASK
  ==============================================
  */

  async function save(e) {

    e.preventDefault();


    setStatus("");


    setError("");


    const cleanOptions =
      options
        .map(
          (option) => ({
            text:
              String(
                option.text || ""
              ).trim(),

            isCorrect:
              option.isCorrect === true
          })
        )
        .filter(
          (option) =>
            option.text
        );


    if (
      cleanOptions.length < 2
    ) {

      setError(
        "Please enter at least 2 answer choices."
      );

      return;

    }


    const correctCount =
      cleanOptions.filter(
        (option) =>
          option.isCorrect
      ).length;


    if (
      correctCount !== 1
    ) {

      setError(
        "Please select exactly one correct answer."
      );

      return;

    }


    const displayLimit =
      Number(
        f.displayLimit
      );


    if (
      !Number.isInteger(
        displayLimit
      ) ||
      displayLimit < 1
    ) {

      setError(
        "Display limit must be at least 1."
      );

      return;

    }


    setStatus(
      editingTaskId
        ? "Updating task..."
        : "Saving task..."
    );


    try {

      let imageUrl =
        f.imageUrl;


      if (image) {
        imageUrl =
          await uploadImage();
      }


      const payload = {

        ...f,

        imageUrl,

        displayLimit,

        options:
          cleanOptions

      };


      if (
        editingTaskId
      ) {
        payload.taskId =
          editingTaskId;
      }


      const r =
        await fetch(
          "/api/admin/tasks",
          {

            method:
              editingTaskId
                ? "PUT"
                : "POST",

            headers: {
              "content-type":
                "application/json"
            },

            body:
              JSON.stringify(
                payload
              )

          }
        );


      const d =
        await r.json();


      if (!r.ok) {
        throw new Error(
          d.error ||
          "Unable to save task."
        );
      }


      setStatus(
        editingTaskId
          ? "Task updated successfully."
          : "Task saved successfully."
      );


      await load();


      setTimeout(
        () => {
          resetForm();
        },
        500
      );

    } catch (e) {

      setError(
        e.message
      );


      setStatus("");

    }

  }


  /*
  ==============================================
  DELETE TASK
  ==============================================
  */

  async function deleteTask(task) {

    const confirmed =
      window.confirm(
        `Delete "${task.title}"?\n\nThis will permanently remove the task and its answer choices.`
      );


    if (!confirmed) {
      return;
    }


    setDeletingId(
      task.id
    );


    setStatus("");


    setError("");


    try {

      const r =
        await fetch(
          "/api/admin/tasks",
          {

            method:
              "DELETE",

            headers: {
              "content-type":
                "application/json"
            },

            body:
              JSON.stringify({
                taskId:
                  task.id
              })

          }
        );


      const d =
        await r.json();


      if (!r.ok) {
        throw new Error(
          d.error ||
          "Unable to delete task."
        );
      }


      if (
        editingTaskId === task.id
      ) {
        resetForm();
      }


      setStatus(
        "Task deleted successfully."
      );


      await load();

    } catch (e) {

      setError(
        e.message
      );

    } finally {

      setDeletingId(null);

    }

  }


  return (

    <main
      className={
        `mobile-shell scroll-page ${styles.page}`
      }
    >

      <header className="topbar">

        <div>

          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>


          <h1>
            Task Management
          </h1>


          <p className="muted">
            Create, edit and manage tasks
            for Global Nexus Capital users.
          </p>

        </div>


        <Link
          className="icon-button"
          href="/admin"
        >
          ←
        </Link>

      </header>


      {/* CREATE / EDIT FORM */}

      <form
        className="admin-card"
        onSubmit={save}
      >

        <div
          className="admin-card-head"
        >

          <strong>

            {editingTaskId
              ? "Edit Task"
              : "Create Task"}

          </strong>


          {editingTaskId && (

            <button
              type="button"
              className="secondary-button"
              onClick={resetForm}
            >
              Cancel Edit
            </button>

          )}

        </div>


        <div className="form-card">


          {/* TITLE */}

          <label>

            Task title

            <input
              required
              value={f.title}
              onChange={(e) =>
                set(
                  "title",
                  e.target.value
                )
              }
            />

          </label>


          {/* DESCRIPTION */}

          <label>

            Description

            <textarea
              required
              value={f.description}
              onChange={(e) =>
                set(
                  "description",
                  e.target.value
                )
              }
            />

          </label>


          {/* IMAGE */}

          <label>

            Task image

            <input
              id="task-image"
              type="file"
              accept="image/*"
              onChange={(e) =>
                setImage(
                  e.target.files?.[0] ||
                  null
                )
              }
            />

          </label>


          {f.imageUrl && (

            <div
              className="empty-document"
            >

              <span>
                Current image
              </span>


              <img
                src={f.imageUrl}
                alt="Task"
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  marginTop: "10px"
                }}
              />

            </div>

          )}


          {/* QUESTION */}

          <label>

            Question

            <textarea
              required
              value={f.question}
              onChange={(e) =>
                set(
                  "question",
                  e.target.value
                )
              }
            />

          </label>


          {/* ANSWER CHOICES */}

          <div className="form-section">

            <div
              className="section-heading"
            >

              <strong>
                Answer Choices
              </strong>


              <span className="muted">
                Select exactly one correct answer.
              </span>

            </div>


            <div className="answer-list">

              {options.map(
                (option, index) => (

                  <div
                    className="answer-row"
                    key={index}
                  >

                    <div
                      className="answer-number"
                    >
                      {index + 1}
                    </div>


                    <input
                      required
                      placeholder={
                        `Answer ${index + 1}`
                      }
                      value={option.text}
                      onChange={(e) =>
                        updateOption(
                          index,
                          e.target.value
                        )
                      }
                    />


                    <button
                      type="button"
                      className={
                        option.isCorrect
                          ? "correct-button"
                          : "secondary-button"
                      }
                      onClick={() =>
                        makeCorrect(index)
                      }
                    >

                      {option.isCorrect
                        ? "✓ Correct"
                        : "Make correct"}

                    </button>


                    {options.length > 2 && (

                      <button
                        type="button"
                        className="danger-button"
                        onClick={() =>
                          removeOption(index)
                        }
                      >
                        ×
                      </button>

                    )}

                  </div>

                )
              )}

            </div>


            <button
              type="button"
              className="
                secondary-button
                add-answer-button
              "
              onClick={addOption}
            >
              + Add another answer
            </button>

          </div>


          {/* SETTINGS */}

          <div className="setting-grid">


            <label>

              Commission

              <input
                required
                inputMode="decimal"
                value={f.commission}
                onChange={(e) =>
                  set(
                    "commission",
                    e.target.value
                  )
                }
              />

            </label>


            <label>

              Rank

              <select
                value={f.rankId}
                onChange={(e) =>
                  set(
                    "rankId",
                    e.target.value
                  )
                }
              >

                <option value="">
                  All ranks
                </option>


                {ranks.map((r) => (

                  <option
                    key={r.id}
                    value={r.id}
                  >

                    LV {r.rank_number}
                    {" — "}
                    {r.name}

                  </option>

                ))}

              </select>

            </label>


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


            {/* NEW DISPLAY LIMIT */}

            <label>

              Number of displays

              <input
                required
                min="1"
                type="number"
                inputMode="numeric"
                value={f.displayLimit}
                onChange={(e) =>
                  set(
                    "displayLimit",
                    e.target.value
                  )
                }
              />

              <span className="muted">
                How many times this task can be
                displayed in one task cycle.
              </span>

            </label>


            <label>

              Status

              <select
                value={
                  f.active
                    ? "active"
                    : "inactive"
                }
                onChange={(e) =>
                  set(
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


          {/* SAVE */}

          <button
            className="primary-button"
            type="submit"
            disabled={uploading}
          >

            {uploading
              ? "Uploading image..."
              : editingTaskId
                ? "Update Task"
                : "Save Task"}

          </button>


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


      {/* EXISTING TASKS */}

      <section
        className="admin-card"
      >

        <strong>
          Existing Tasks
        </strong>


        {rows.length === 0 ? (

          <div
            className="empty-document"
          >

            <span>
              No tasks created yet.
            </span>

          </div>

        ) : (

          <div className="task-list">

            {rows.map(
              (task) => (

                <div
                  className="form-card"
                  key={task.id}
                >

                  <div
                    className="admin-card-head"
                  >

                    <div>

                      <strong>
                        {task.title}
                      </strong>


                      <p className="muted">

                        {task.active
                          ? "● Active"
                          : "○ Inactive"}

                      </p>

                    </div>


                    <div
                      style={{
                        display: "flex",
                        gap: "8px"
                      }}
                    >

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          editTask(task)
                        }
                      >
                        ✏️ Edit
                      </button>


                      <button
                        type="button"
                        className="danger-button"
                        disabled={
                          deletingId ===
                          task.id
                        }
                        onClick={() =>
                          deleteTask(task)
                        }
                      >

                        {deletingId ===
                        task.id
                          ? "Deleting..."
                          : "🗑 Delete"}

                      </button>

                    </div>

                  </div>


                  {task.image_url && (

                    <img
                      src={task.image_url}
                      alt={task.title}
                      style={{
                        width: "100%",
                        borderRadius:
                          "12px",
                        marginTop:
                          "12px"
                      }}
                    />

                  )}


                  <p className="muted">

                    <strong>
                      Question:
                    </strong>

                    {" "}

                    {task.question}

                  </p>


                  {Array.isArray(
                    task.options
                  ) &&
                    task.options.length > 0 && (

                      <div>

                        {task.options.map(
                          (option) => (

                            <div
                              key={option.id}
                              className="empty-document"
                            >

                              <span>

                                {option.displayOrder}.
                                {" "}
                                {option.text}

                              </span>


                              {option.isCorrect && (

                                <strong>
                                  ✓ Correct
                                </strong>

                              )}

                            </div>

                          )
                        )}

                      </div>

                    )}


                  <div
                    style={{
                      marginTop:
                        "12px"
                    }}
                  >

                    <span className="muted">

                      Commission: GHS{" "}

                      {Number(
                        task.commission_amount ??
                        task.commission_per_task ??
                        0
                      ).toLocaleString(
                        "en-GH",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }
                      )}

                    </span>

                  </div>


                  {/* DISPLAY LIMIT SHOW */}

                  <div
                    style={{
                      marginTop:
                        "8px"
                    }}
                  >

                    <span className="muted">

                      Number of displays:
                      {" "}

                      <strong>
                        {task.display_limit ?? 1}
                      </strong>

                    </span>

                  </div>


                  <div
                    style={{
                      marginTop:
                        "8px"
                    }}
                  >

                    <span className="muted">

                      Rank:
                      {" "}

                      {task.rank_id
                        ? "Rank-specific task"
                        : "All ranks"}

                    </span>

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </section>

    </main>

  );
}
