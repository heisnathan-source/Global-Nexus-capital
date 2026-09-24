import { getDb } from "@/lib/db.js";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/session.js";

function adminSession(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
  const session = match ? verifySessionToken(match[1]) : null;
  return session && session.role === "admin" ? session : null;
}

async function tableColumns(db, tableName) {
  const result = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = $1`,
    [tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

function columnOrNull(columns, name) {
  return columns.has(name) ? `a.${name}` : "NULL";
}

export async function GET(request) {
  const session = adminSession(request);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();

    const requestedLimit = Number(
      new URL(request.url).searchParams.get("limit") || 100
    );

    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 250)
      : 100;

    const [auditColumns, actionColumns] = await Promise.all([
      tableColumns(db, "audit_logs"),
      tableColumns(db, "admin_actions")
    ]);

    const auditTime = auditColumns.has("created_at")
      ? "a.created_at"
      : auditColumns.has("timestamp")
        ? "a.timestamp"
        : "NULL";

    const actionTime = actionColumns.has("created_at")
      ? "a.created_at"
      : actionColumns.has("timestamp")
        ? "a.timestamp"
        : "NULL";

    const auditQuery = auditColumns.has("id")
      ? `
        SELECT
          'audit_log' AS source,
          a.id::text AS event_id,
          a.action AS action,
          a.entity_type AS entity_type,
          ${columnOrNull(auditColumns, "entity_id")}::text AS target_id,
          ${columnOrNull(auditColumns, "reason")} AS reason,
          ${columnOrNull(auditColumns, "new_value")} AS details,
          a.admin_user_id::text AS admin_user_id,
          ${auditTime} AS occurred_at,
          u.name AS admin_name,
          u.phone AS admin_phone
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.admin_user_id
      `
      : null;

    const actionQuery = actionColumns.has("id")
      ? `
        SELECT
          'admin_action' AS source,
          a.id::text AS event_id,
          a.action_type AS action,
          a.target_type AS entity_type,
          ${columnOrNull(actionColumns, "target_id")}::text AS target_id,
          ${columnOrNull(actionColumns, "reason")} AS reason,
          ${columnOrNull(actionColumns, "metadata")} AS details,
          a.admin_user_id::text AS admin_user_id,
          ${actionTime} AS occurred_at,
          u.name AS admin_name,
          u.phone AS admin_phone
        FROM admin_actions a
        LEFT JOIN users u ON u.id = a.admin_user_id
      `
      : null;

    const sources = [auditQuery, actionQuery].filter(Boolean);

    if (!sources.length) {
      return Response.json({ events: [] });
    }

    const query = `
      SELECT *
      FROM (${sources.join(" UNION ALL ")}) events
      ORDER BY occurred_at DESC NULLS LAST, event_id DESC
      LIMIT $1
    `;

    const result = await db.query(query, [limit]);

    return Response.json({
      events: result.rows
    });
  } catch (error) {
    console.error("GET /api/admin/audit error:", error);

    return Response.json(
      { error: "Unable to load audit events." },
      { status: 500 }
    );
  }
}
