import crypto from "crypto";
import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

const MAX_DRAWS_PER_GRANT = 100;

function adminSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session && session.role === "admin"
    ? session
    : null;
}

export async function POST(request) {
  const session = adminSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let client;

  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const mode =
      String(body?.mode || "").trim();

    const userId =
      body?.userId || null;

    const rankId =
      body?.rankId || null;

    const eventId =
      body?.eventId || null;

    const draws =
      Math.trunc(
        Number(body?.draws)
      );

    if (!eventId) {
      return Response.json(
        {
          error:
            "Please select an event."
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(draws) ||
      draws < 1
    ) {
      return Response.json(
        {
          error:
            "Raffle Ticket amount must be at least 1."
        },
        { status: 400 }
      );
    }

    if (draws > MAX_DRAWS_PER_GRANT) {
      return Response.json(
        {
          error:
            `Raffle Ticket grant cannot exceed ${MAX_DRAWS_PER_GRANT} draws at once.`
        },
        { status: 400 }
      );
    }

    if (
      mode !== "user" &&
      mode !== "rank"
    ) {
      return Response.json(
        {
          error:
            "Invalid Raffle Ticket grant mode."
        },
        { status: 400 }
      );
    }

    if (
      mode === "user" &&
      !userId
    ) {
      return Response.json(
        {
          error:
            "Please select a user."
        },
        { status: 400 }
      );
    }

    if (
      mode === "rank" &&
      !rankId
    ) {
      return Response.json(
        {
          error:
            "Please select a rank."
        },
        { status: 400 }
      );
    }

    const db = getDb();

    client = await db.connect();

    await client.query("BEGIN");

    const eventCheck =
      await client.query(
        `
        SELECT
          id,
          name
        FROM events
        WHERE id = $1
        LIMIT 1
        `,
        [eventId]
      );

    if (!eventCheck.rowCount) {
      throw new Error(
        "Selected event was not found."
      );
    }

    let users = [];
    let selectedRank = null;

    if (mode === "user") {
      const userCheck =
        await client.query(
          `
          SELECT
            u.id,
            u.name,
            u.account_id,
            u.role,
            u.enabled
          FROM users u
          WHERE u.id = $1
          LIMIT 1
          `,
          [userId]
        );

      if (!userCheck.rowCount) {
        throw new Error(
          "Selected user was not found."
        );
      }

      const selectedUser =
        userCheck.rows[0];

      if (selectedUser.role !== "user") {
        throw new Error(
          "Raffle Tickets can only be granted to user accounts."
        );
      }

      if (!selectedUser.enabled) {
        throw new Error(
          "Raffle Tickets cannot be granted to a disabled user account."
        );
      }

      users = [selectedUser];
    }

    if (mode === "rank") {
      const rankCheck =
        await client.query(
          `
          SELECT
            id,
            name
          FROM ranks
          WHERE id = $1
          LIMIT 1
          `,
          [rankId]
        );

      if (!rankCheck.rowCount) {
        throw new Error(
          "Selected rank was not found."
        );
      }

      selectedRank =
        rankCheck.rows[0];

      const rankUsers =
        await client.query(
          `
          SELECT
            id,
            name,
            account_id,
            role,
            enabled
          FROM users
          WHERE rank_id = $1
            AND role = 'user'
            AND enabled = TRUE
          ORDER BY registration_date ASC
          `,
          [rankId]
        );

      users = rankUsers.rows;
    }

    if (!users.length) {
      throw new Error(
        mode === "rank"
          ? "There are no active users in this rank."
          : "No user was found."
      );
    }

    for (const user of users) {
      await client.query(
        `
        INSERT INTO lucky_card_balances
          (
            user_id,
            event_id,
            available_draws,
            updated_at
          )
        VALUES
          (
            $1,
            $2,
            $3,
            NOW()
          )
        ON CONFLICT
          (
            user_id,
            event_id
          )
        DO UPDATE SET
          available_draws =
            lucky_card_balances.available_draws +
            EXCLUDED.available_draws,
          updated_at = NOW()
        `,
        [
          user.id,
          eventId,
          draws
        ]
      );
    }

    /*
     * Record the administrative grant inside the same
     * transaction as the ticket balance changes.
     *
     * Do not store any ticket balances or sensitive
     * information in the audit record.
     */
    await client.query(
      `
      INSERT INTO audit_logs(
        id,
        admin_user_id,
        action,
        entity_type,
        entity_id,
        new_value,
        created_at
      )
      VALUES(
        $1,
        $2,
        'grant_raffle_tickets',
        $3,
        $4,
        $5,
        NOW()
      )
      `,
      [
        crypto.randomUUID(),
        session.userId,
        mode === "user"
          ? "user"
          : "rank",
        mode === "user"
          ? userId
          : rankId,
        JSON.stringify({
          eventId,
          eventName: eventCheck.rows[0].name,
          mode,
          drawsPerUser: draws,
          affectedUsers: users.length,
          ...(mode === "user"
            ? {
                userId,
                userName: users[0].name,
                accountId: users[0].account_id
              }
            : {
                rankId,
                rankName: selectedRank?.name || null
              })
        })
      ]
    );

    await client.query("COMMIT");

    const eventName =
      eventCheck.rows[0].name;

    return Response.json({
      ok: true,

      message:
        mode === "user"
          ? `${draws} Raffle Ticket draw(s) successfully given to ${users[0].name}.`
          : `${draws} Raffle Ticket draw(s) successfully given to ${users.length} user(s) in the selected rank.`,

      event: eventName,

      affectedUsers:
        users.length,

      drawsPerUser:
        draws
    });

  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    console.error(
      "RAFFLE TICKET GRANT ERROR:",
      error
    );

    const safeErrors = [
      "Selected event was not found.",
      "Selected user was not found.",
      "Selected rank was not found.",
      "There are no active users in this rank.",
      "No user was found.",
      "Raffle Tickets can only be granted to user accounts.",
      "Raffle Tickets cannot be granted to a disabled user account."
    ];

    return Response.json(
      {
        error:
          safeErrors.includes(error?.message)
            ? error.message
            : "Unable to give Raffle Tickets."
      },
      { status: 400 }
    );

  } finally {
    if (client) {
      client.release();
    }
  }
}
