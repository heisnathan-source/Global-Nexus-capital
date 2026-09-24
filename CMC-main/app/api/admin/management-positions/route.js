import crypto from "crypto";
import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function adminSession(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  if (!match) return null;

  const session = verifySessionToken(match[1]);

  return session && session.role === "admin" ? session : null;
}

function positiveInteger(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return fallback;
  return n;
}

function money(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function positionPayload(body) {
  return {
    name: String(body?.name || "").trim().slice(0, 120),
    requiredDirectMembers: positiveInteger(
      body?.requiredDirectMembers
    ),
    requiredQualifyingMembers: positiveInteger(
      body?.requiredQualifyingMembers
    ),
    salaryAmount: money(body?.salaryAmount),
    paymentIntervalMonths: Math.max(
      1,
      positiveInteger(body?.paymentIntervalMonths, 2)
    ),
    cashBonus: money(body?.cashBonus),
    displayOrder: positiveInteger(body?.displayOrder, 0),
    active: body?.active !== false,
  };
}

export async function GET(request) {
  const session = adminSession(request);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();

    const result = await db.query(`
      SELECT
        mp.id,
        mp.name,
        mp.required_qualifying_members,
        mp.qualifying_purchase_required,
        mp.salary_amount,
        mp.payment_interval_months,
        mp.active,
        mp.display_order,
        mp.required_direct_members,
        mp.cash_bonus,
        EXISTS (
          SELECT 1
          FROM management_contracts mc
          WHERE mc.position_id = mp.id
        ) AS has_contract_history
      FROM management_positions mp
      ORDER BY mp.display_order ASC, mp.id ASC
    `);

    return Response.json({
      positions: result.rows,
    });
  } catch (error) {
    console.error("GET /api/admin/management-positions:", error);

    return Response.json(
      { error: "Unable to load management positions." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = adminSession(request);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = positionPayload(body);

    if (!data.name) {
      return Response.json(
        { error: "Position name is required." },
        { status: 400 }
      );
    }

    const db = getDb();
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        INSERT INTO management_positions (
          name,
          required_qualifying_members,
          qualifying_purchase_required,
          salary_amount,
          payment_interval_months,
          active,
          display_order,
          required_direct_members,
          cash_bonus
        )
        VALUES ($1,$2,TRUE,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [
          data.name,
          data.requiredQualifyingMembers,
          data.salaryAmount,
          data.paymentIntervalMonths,
          data.active,
          data.displayOrder,
          data.requiredDirectMembers,
          data.cashBonus,
        ]
      );

      const position = result.rows[0];

      await client.query(
        `
        INSERT INTO audit_logs (
          id,
          admin_user_id,
          action,
          entity_type,
          entity_id,
          new_value,
          created_at
        )
        VALUES (
          $1,
          $2,
          'create_management_position',
          'management_position',
          $3,
          $4,
          NOW()
        )
        `,
        [
          crypto.randomUUID(),
          session.userId,
          position.id,
          JSON.stringify({
            name: position.name,
            requiredDirectMembers: position.required_direct_members,
            requiredQualifyingMembers:
              position.required_qualifying_members,
            salaryAmount: position.salary_amount,
            paymentIntervalMonths:
              position.payment_interval_months,
            cashBonus: position.cash_bonus,
            displayOrder: position.display_order,
            active: position.active,
          }),
        ]
      );

      await client.query("COMMIT");

      return Response.json({
        ok: true,
        position,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /api/admin/management-positions:", error);

    return Response.json(
      { error: "Unable to create management position." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const session = adminSession(request);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const id = String(body?.id || "").trim();

    if (!id) {
      return Response.json(
        { error: "Position ID is required." },
        { status: 400 }
      );
    }

    const data = positionPayload(body);

    if (!data.name) {
      return Response.json(
        { error: "Position name is required." },
        { status: 400 }
      );
    }

    const db = getDb();
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const beforeResult = await client.query(
        `
        SELECT *
        FROM management_positions
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (!beforeResult.rowCount) {
        await client.query("ROLLBACK");

        return Response.json(
          { error: "Management position not found." },
          { status: 404 }
        );
      }

      const previous = beforeResult.rows[0];

      const result = await client.query(
        `
        UPDATE management_positions
        SET
          name = $1,
          required_qualifying_members = $2,
          salary_amount = $3,
          payment_interval_months = $4,
          active = $5,
          display_order = $6,
          required_direct_members = $7,
          cash_bonus = $8
        WHERE id = $9
        RETURNING *
        `,
        [
          data.name,
          data.requiredQualifyingMembers,
          data.salaryAmount,
          data.paymentIntervalMonths,
          data.active,
          data.displayOrder,
          data.requiredDirectMembers,
          data.cashBonus,
          id,
        ]
      );

      const position = result.rows[0];

      await client.query(
        `
        INSERT INTO audit_logs (
          id,
          admin_user_id,
          action,
          entity_type,
          entity_id,
          previous_value,
          new_value,
          created_at
        )
        VALUES (
          $1,
          $2,
          'update_management_position',
          'management_position',
          $3,
          $4,
          $5,
          NOW()
        )
        `,
        [
          crypto.randomUUID(),
          session.userId,
          id,
          JSON.stringify(previous),
          JSON.stringify(position),
        ]
      );

      await client.query("COMMIT");

      return Response.json({
        ok: true,
        position,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("PATCH /api/admin/management-positions:", error);

    return Response.json(
      { error: "Unable to update management position." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const session = adminSession(request);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();

    if (!id) {
      return Response.json(
        { error: "Position ID is required." },
        { status: 400 }
      );
    }

    const db = getDb();
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const positionResult = await client.query(
        `
        SELECT *
        FROM management_positions
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (!positionResult.rowCount) {
        await client.query("ROLLBACK");

        return Response.json(
          { error: "Management position not found." },
          { status: 404 }
        );
      }

      const position = positionResult.rows[0];

      const contractResult = await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM management_contracts
        WHERE position_id = $1
        `,
        [id]
      );

      const contractCount = Number(
        contractResult.rows[0]?.count || 0
      );

      if (contractCount > 0) {
        await client.query("ROLLBACK");

        return Response.json(
          {
            error:
              "This position cannot be deleted because it is already linked to management contract history. Deactivate it instead.",
          },
          { status: 409 }
        );
      }

      await client.query(
        `
        DELETE FROM management_positions
        WHERE id = $1
        `,
        [id]
      );

      await client.query(
        `
        INSERT INTO audit_logs (
          id,
          admin_user_id,
          action,
          entity_type,
          entity_id,
          previous_value,
          created_at
        )
        VALUES (
          $1,
          $2,
          'delete_management_position',
          'management_position',
          $3,
          $4,
          NOW()
        )
        `,
        [
          crypto.randomUUID(),
          session.userId,
          id,
          JSON.stringify(position),
        ]
      );

      await client.query("COMMIT");

      return Response.json({
        ok: true,
        deleted: true,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("DELETE /api/admin/management-positions:", error);

    return Response.json(
      { error: "Unable to delete management position." },
      { status: 500 }
    );
  }
}
