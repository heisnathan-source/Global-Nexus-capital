import {
  getAvailableTasks,
  submitTask,
} from "@/lib/task-service.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME,
} from "@/lib/session.js";

function session(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const sessionData = match
    ? verifySessionToken(match[1])
    : null;

  return sessionData &&
    sessionData.role === "user"
    ? sessionData
    : null;
}

function publicTaskError(error) {
  const message =
    error instanceof Error
      ? error.message
      : "";

  /*
   * These are deliberate task/business
   * messages. Unexpected database or
   * implementation errors are hidden.
   */
  const safeExactMessages = new Set([
    "Task is required.",
    "Task not found.",
    "Task is unavailable.",
    "Tasks are not available for your rank today.",
    "Task is locked.",
    "You have reached the maximum number of attempts for this task.",
    "You have already completed this task.",
    "Invalid answer.",
    "Incorrect answer.",
  ]);

  if (safeExactMessages.has(message)) {
    return message;
  }

  /*
   * Preserve deliberate task-service
   * messages that describe user-facing
   * eligibility/limits, while avoiding
   * returning arbitrary SQL errors.
   */
  const safePrefixes = [
    "You have reached",
    "This task",
    "Task ",
    "You must",
    "You need",
    "Incorrect",
    "Invalid",
  ];

  if (
    safePrefixes.some(
      prefix =>
        message.startsWith(prefix)
    ) &&
    !message.includes("SQL") &&
    !message.includes("column") &&
    !message.includes("relation") &&
    !message.includes("constraint") &&
    !message.includes("database")
  ) {
    return message;
  }

  return "Unable to process the task.";
}

export async function GET(request) {
  const sessionData = session(request);

  if (!sessionData) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const tasks =
      await getAvailableTasks(
        sessionData.userId
      );

    return Response.json({
      tasks,
    });
  } catch (error) {
    console.error(
      "Tasks GET error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load available tasks.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const sessionData = session(request);

  if (!sessionData) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }

  const taskId = body?.taskId;
  const answer = body?.answer;

  if (!taskId) {
    return Response.json(
      { error: "Task is required." },
      { status: 400 }
    );
  }

  try {
    const submission =
      await submitTask(
        sessionData.userId,
        taskId,
        answer
      );

    return Response.json(
      { submission },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Task submission API error:",
      error
    );

    return Response.json(
      {
        error:
          publicTaskError(error),
      },
      { status: 400 }
    );
  }
}
