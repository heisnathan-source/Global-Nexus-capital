import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";

function admin(request) {
  const c =
    request.headers.get("cookie") || "";

  const m = c.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const s = m
    ? verifySessionToken(m[1])
    : null;

  return s && s.role === "admin"
    ? s
    : null;
}

export async function GET(request) {
  if (!admin(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const [
      events,
      ranks,
      rules,
    ] = await Promise.all([
      db.query(`
        SELECT
          id,
          name,
          status,
          start_at,
          end_at
        FROM events
        ORDER BY created_at DESC
      `),

      db.query(`
        SELECT
          id,
          name,
          rank_number
        FROM ranks
        WHERE rank_number BETWEEN 1 AND 9
        ORDER BY rank_number
      `),

      db.query(`
        SELECT
          lcr.*,
          e.name AS event_name,
          r.name AS rank_name,
          COUNT(lcd.id)::int AS draw_count
        FROM lucky_card_rules lcr
        LEFT JOIN events e
          ON e.id = lcr.event_id
        LEFT JOIN ranks r
          ON r.id = lcr.rank_id
        LEFT JOIN lucky_card_draws lcd
          ON lcd.rule_id = lcr.id
        GROUP BY
          lcr.id,
          e.name,
          r.name
        ORDER BY
          lcr.draws_required ASC,
          lcr.id DESC
      `),
    ]);

    return Response.json({
      events: events.rows,
      ranks: ranks.rows,
      prizes: rules.rows,
    });
  } catch (error) {
    console.error(
      "Admin Lucky Cards GET failed:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load Raffle Ticket settings.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!admin(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let b;

  try {
    b = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request data." },
      { status: 400 }
    );
  }

  try {
    const prizeName =
      String(
        b.prizeName || ""
      ).trim();

    const prizeAmount =
      Number(
        b.prizeAmount ??
        b.prizeValue ??
        0
      );

    const drawsRequired =
      Math.max(
        1,
        Math.trunc(
          Number(
            b.drawsRequired ?? 1
          )
        )
      );

    const drawNumber =
      Math.max(
        1,
        Math.trunc(
          Number(
            b.drawNumber ??
            b.drawsRequired ??
            1
          )
        )
      );

    const maxWinners =
      Math.max(
        0,
        Math.trunc(
          Number(
            b.maxWinners ?? 0
          )
        )
      );

    const boxPosition =
      Math.max(
        1,
        Math.min(
          6,
          Math.trunc(
            Number(
              b.boxPosition ?? 1
            )
          )
        )
      );

    const prizeType =
      [
        "cash",
        "points",
        "gift",
      ].includes(b.prizeType)
        ? b.prizeType
        : "cash";

    if (
      !b.eventId ||
      !prizeName ||
      !Number.isFinite(prizeAmount) ||
      prizeAmount < 0
    ) {
      return Response.json(
        {
          error:
            "Please provide a valid event and prize settings.",
        },
        { status: 400 }
      );
    }

    const db = getDb();

    const q = await db.query(
      `
        INSERT INTO lucky_card_rules
        (
          event_id,
          rank_id,
          draws_required,
          draw_number,
          prize_name,
          prize_amount,
          prize_type,
          max_winners,
          box_position,
          active
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *
      `,
      [
        b.eventId,
        b.rankId || null,
        drawsRequired,
        drawNumber,
        prizeName,
        prizeAmount,
        prizeType,
        maxWinners,
        boxPosition,
        b.active !== false,
      ]
    );

    return Response.json(
      {
        ok: true,
        prize: q.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Admin Lucky Cards POST failed:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to save Raffle Ticket prize.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  if (!admin(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let b;

  try {
    b = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request data." },
      { status: 400 }
    );
  }

  try {
    const ruleId =
      String(b.id || "").trim();

    const prizeName =
      String(
        b.prizeName || ""
      ).trim();

    const prizeAmount =
      Number(b.prizeAmount ?? 0);

    const drawsRequired =
      Math.max(
        1,
        Math.trunc(
          Number(
            b.drawsRequired ?? 1
          )
        )
      );

    const drawNumber =
      Math.max(
        1,
        Math.trunc(
          Number(
            b.drawNumber ??
            b.drawsRequired ??
            1
          )
        )
      );

    const maxWinners =
      Math.max(
        0,
        Math.trunc(
          Number(
            b.maxWinners ?? 0
          )
        )
      );

    const boxPosition =
      Math.max(
        1,
        Math.min(
          6,
          Math.trunc(
            Number(
              b.boxPosition ?? 1
            )
          )
        )
      );

    const prizeType =
      [
        "cash",
        "points",
        "gift",
      ].includes(b.prizeType)
        ? b.prizeType
        : "cash";

    if (
      !ruleId ||
      !b.eventId ||
      !prizeName ||
      !Number.isFinite(prizeAmount) ||
      prizeAmount < 0
    ) {
      return Response.json(
        {
          error:
            "Invalid Raffle Ticket prize settings.",
        },
        { status: 400 }
      );
    }

    const db = getDb();

    const existing =
      await db.query(
        `
          SELECT
            lcr.id,
            COUNT(lcd.id)::int AS draw_count
          FROM lucky_card_rules lcr
          LEFT JOIN lucky_card_draws lcd
            ON lcd.rule_id = lcr.id
          WHERE lcr.id = $1
          GROUP BY lcr.id
        `,
        [ruleId]
      );

    if (!existing.rowCount) {
      return Response.json(
        {
          error:
            "Raffle Ticket rule not found.",
        },
        { status: 404 }
      );
    }

    const drawCount =
      Number(
        existing.rows[0]?.draw_count || 0
      );

    if (drawCount > 0) {
      return Response.json(
        {
          error:
            "This rule already has draw history and cannot be edited. Create a new rule instead.",
        },
        { status: 409 }
      );
    }

    const updated =
      await db.query(
        `
          UPDATE lucky_card_rules
          SET
            event_id = $2,
            rank_id = $3,
            draws_required = $4,
            draw_number = $5,
            prize_name = $6,
            prize_amount = $7,
            prize_type = $8,
            max_winners = $9,
            box_position = $10,
            active = $11
          WHERE id = $1
          RETURNING *
        `,
        [
          ruleId,
          b.eventId,
          b.rankId || null,
          drawsRequired,
          drawNumber,
          prizeName,
          prizeAmount,
          prizeType,
          maxWinners,
          boxPosition,
          b.active !== false,
        ]
      );

    return Response.json({
      ok: true,
      prize: updated.rows[0],
    });
  } catch (error) {
    console.error(
      "Admin Lucky Cards PUT failed:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to update Raffle Ticket prize.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  if (!admin(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let b;

  try {
    b = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request data." },
      { status: 400 }
    );
  }

  try {
    const ruleId =
      String(b.id || "").trim();

    if (!ruleId) {
      return Response.json(
        {
          error:
            "Raffle Ticket rule ID is required.",
        },
        { status: 400 }
      );
    }

    if (typeof b.active !== "boolean") {
      return Response.json(
        {
          error:
            "Active status is required.",
        },
        { status: 400 }
      );
    }

    const db = getDb();

    const updated =
      await db.query(
        `
          UPDATE lucky_card_rules
          SET active = $2
          WHERE id = $1
          RETURNING *
        `,
        [
          ruleId,
          b.active,
        ]
      );

    if (!updated.rowCount) {
      return Response.json(
        {
          error:
            "Raffle Ticket rule not found.",
        },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      prize: updated.rows[0],
    });
  } catch (error) {
    console.error(
      "Admin Lucky Cards PATCH failed:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to update Raffle Ticket status.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  if (!admin(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } =
      new URL(request.url);

    const ruleId =
      String(
        searchParams.get("id") || ""
      ).trim();

    if (!ruleId) {
      return Response.json(
        {
          error:
            "Raffle Ticket rule ID is required.",
        },
        { status: 400 }
      );
    }

    const db = getDb();

    const history =
      await db.query(
        `
          SELECT COUNT(*)::int AS draw_count
          FROM lucky_card_draws
          WHERE rule_id = $1
        `,
        [ruleId]
      );

    if (
      Number(
        history.rows[0]?.draw_count || 0
      ) > 0
    ) {
      return Response.json(
        {
          error:
            "This rule has Raffle Ticket draw history and cannot be deleted.",
        },
        { status: 409 }
      );
    }

    const deleted =
      await db.query(
        `
          DELETE FROM lucky_card_rules
          WHERE id = $1
          RETURNING *
        `,
        [ruleId]
      );

    if (!deleted.rowCount) {
      return Response.json(
        {
          error:
            "Raffle Ticket rule not found.",
        },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      deleted: deleted.rows[0],
    });
  } catch (error) {
    console.error(
      "Admin Lucky Cards DELETE failed:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to delete Raffle Ticket prize.",
      },
      { status: 500 }
    );
  }
}
