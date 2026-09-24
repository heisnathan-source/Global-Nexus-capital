import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

function admin(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  if (!match) return null;

  const session =
    verifySessionToken(match[1]);

  if (
    !session ||
    session.role !== "admin"
  ) {
    return null;
  }

  return session;
}

function clean(value) {
  return String(value ?? "").trim();
}

function parseAccount(body) {
  return {
    network: clean(body?.network).toUpperCase(),
    number: clean(body?.paymentNumber || body?.number)
      .replace(/\s/g, ""),
    name: clean(body?.recipientName || body?.name),
    min: body?.minAmount ?? body?.min,
    max:
      body?.maxAmount === "" ||
      body?.maxAmount == null
        ? null
        : body?.maxAmount
  };
}

function invalidAccount({
  network,
  number,
  name,
  min,
  max
}) {
  const minNumber = Number(min);
  const maxNumber =
    max == null || max === ""
      ? null
      : Number(max);

  return (
    !network ||
    !number ||
    !name ||
    !Number.isFinite(minNumber) ||
    minNumber < 0 ||
    (
      maxNumber !== null &&
      (
        !Number.isFinite(maxNumber) ||
        maxNumber < minNumber
      )
    )
  );
}

async function validateStaff(
  db,
  staffId
) {
  const value = clean(staffId);

  if (!value) {
    return null;
  }

  const result = await db.query(
    `
    SELECT
      id,
      name,
      enabled
    FROM users
    WHERE id = $1
    AND role = 'verification_staff'
    LIMIT 1
    `,
    [value]
  );

  if (!result.rowCount) {
    throw new Error(
      "Selected verification staff account does not exist."
    );
  }

  if (!result.rows[0].enabled) {
    throw new Error(
      "Selected verification staff account is disabled."
    );
  }

  return result.rows[0];
}

export async function GET(request) {
  const session = admin(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const db = getDb();

  try {
    const [
      accounts,
      prefixes,
      networks,
      staff
    ] = await Promise.all([
      db.query(`
        SELECT
          p.id,
          pn.name AS network,
          p.account_number AS payment_number,
          p.recipient_name,
          p.min_amount,
          p.max_amount,
          p.active,
          p.in_use,
          p.last_assigned_at,
          p.assigned_staff_id,
          u.name AS assigned_staff_name
        FROM payment_wallet_pool p
        INNER JOIN payment_networks pn
          ON pn.id = p.network_id
        LEFT JOIN users u
          ON u.id = p.assigned_staff_id
          AND u.role = 'verification_staff'
        ORDER BY
          pn.name,
          p.last_assigned_at NULLS FIRST,
          p.account_number
      `),

      db.query(`
        SELECT
          id,
          prefix,
          network,
          active
        FROM network_prefixes
        ORDER BY prefix
      `),

      db.query(`
        SELECT
          id,
          name
        FROM payment_networks
        ORDER BY name
      `),

      db.query(`
        SELECT
          id,
          name,
          staff_login,
          enabled
        FROM users
        WHERE role = 'verification_staff'
        AND enabled = TRUE
        ORDER BY name
      `)
    ]);

    return Response.json({
      accounts: accounts.rows,
      prefixes: prefixes.rows,
      networks: networks.rows,
      staff: staff.rows
    });
  } catch (e) {
    console.error(
      "GET /api/admin/payment-pool error:",
      e
    );

    return Response.json(
      {
        error:
          e?.message ||
          "Unable to load payment pool."
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = admin(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const db = getDb();

  try {
    const body = await request.json();

    const type =
      String(body?.type || "");

    if (
      type === "account" ||
      type === "updateAccount"
    ) {
      const id =
        type === "updateAccount"
          ? clean(body?.id)
          : null;

      if (
        type === "updateAccount" &&
        !id
      ) {
        return Response.json(
          {
            error:
              "Account id is required."
          },
          { status: 400 }
        );
      }

      const {
        network,
        number,
        name,
        min,
        max
      } = parseAccount(body);

      if (
        invalidAccount({
          network,
          number,
          name,
          min,
          max
        })
      ) {
        return Response.json(
          {
            error:
              "Enter a valid network, payment number, recipient and amount range."
          },
          { status: 400 }
        );
      }

      const networkQ =
        await db.query(
          `
          SELECT id, name
          FROM payment_networks
          WHERE UPPER(name) = $1
          LIMIT 1
          `,
          [network]
        );

      if (!networkQ.rowCount) {
        return Response.json(
          {
            error:
              `Payment network "${network}" does not exist.`
          },
          { status: 400 }
        );
      }

      const networkId =
        networkQ.rows[0].id;

      const duplicateQ =
        await db.query(
          `
          SELECT id
          FROM payment_wallet_pool
          WHERE account_number = $1
          AND network_id = $2
          ${id ? "AND id <> $3" : ""}
          LIMIT 1
          `,
          id
            ? [number, networkId, id]
            : [number, networkId]
        );

      if (duplicateQ.rowCount) {
        return Response.json(
          {
            error:
              "That payment number is already configured for this network."
          },
          { status: 409 }
        );
      }

      const staff =
        await validateStaff(
          db,
          body?.staffId
        );

      if (type === "account") {
        try {
          const result =
            await db.query(
              `
              INSERT INTO payment_wallet_pool(
                network_id,
                account_number,
                recipient_name,
                min_amount,
                max_amount,
                assigned_staff_id,
                active,
                in_use
              )
              VALUES(
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                TRUE,
                FALSE
              )
              RETURNING *
              `,
              [
                networkId,
                number,
                name,
                min,
                max,
                staff?.id || null
              ]
            );

          return Response.json(
            {
              account:
                result.rows[0]
            },
            { status: 201 }
          );
        } catch (e) {
          if (e?.code === "23505") {
            return Response.json(
              {
                error:
                  "That payment number is already configured for this network."
              },
              { status: 409 }
            );
          }

          throw e;
        }
      }

      try {
        const result =
          await db.query(
            `
            UPDATE payment_wallet_pool
            SET
              network_id = $1,
              account_number = $2,
              recipient_name = $3,
              min_amount = $4,
              max_amount = $5,
              assigned_staff_id = $6
            WHERE id = $7
            RETURNING *
            `,
            [
              networkId,
              number,
              name,
              min,
              max,
              staff?.id || null,
              id
            ]
          );

        if (!result.rowCount) {
          return Response.json(
            {
              error:
                "Payment account not found."
            },
            { status: 404 }
          );
        }

        return Response.json({
          account:
            result.rows[0]
        });
      } catch (e) {
        if (e?.code === "23505") {
          return Response.json(
            {
              error:
                "That payment number is already configured for this network."
            },
            { status: 409 }
          );
        }

        throw e;
      }
    }

    if (type === "prefix") {
      const prefix =
        String(body?.prefix || "")
          .replace(/\D/g, "");

      const network =
        clean(body?.network).toUpperCase();

      if (
        !/^\d{3}$/.test(prefix) ||
        !network
      ) {
        return Response.json(
          {
            error:
              "Prefix must contain exactly 3 digits and a network."
          },
          { status: 400 }
        );
      }

      const networkQ =
        await db.query(
          `
          SELECT name
          FROM payment_networks
          WHERE UPPER(name) = $1
          LIMIT 1
          `,
          [network]
        );

      if (!networkQ.rowCount) {
        return Response.json(
          {
            error:
              `Payment network "${network}" does not exist.`
          },
          { status: 400 }
        );
      }

      const result =
        await db.query(
          `
          INSERT INTO network_prefixes(
            prefix,
            network,
            active
          )
          VALUES(
            $1,
            $2,
            TRUE
          )
          ON CONFLICT(prefix)
          DO UPDATE SET
            network = EXCLUDED.network,
            active = TRUE
          RETURNING *
          `,
          [
            prefix,
            networkQ.rows[0].name
          ]
        );

      return Response.json(
        {
          prefix:
            result.rows[0]
        },
        { status: 201 }
      );
    }

    if (type === "toggleAccount") {
      if (!body?.id) {
        return Response.json(
          {
            error:
              "Account id is required."
          },
          { status: 400 }
        );
      }

      await db.query(
        `
        UPDATE payment_wallet_pool
        SET active = NOT active
        WHERE id = $1
        `,
        [body.id]
      );

      return Response.json({
        ok: true
      });
    }

    if (type === "togglePrefix") {
      if (!body?.id) {
        return Response.json(
          {
            error:
              "Prefix id is required."
          },
          { status: 400 }
        );
      }

      await db.query(
        `
        UPDATE network_prefixes
        SET active = NOT active
        WHERE id = $1
        `,
        [body.id]
      );

      return Response.json({
        ok: true
      });
    }

    return Response.json(
      {
        error:
          "Unknown payment-pool action."
      },
      { status: 400 }
    );
  } catch (e) {
    console.error(
      "POST /api/admin/payment-pool error:",
      e
    );

    return Response.json(
      {
        error:
          e?.message ||
          "Unable to update payment pool."
      },
      { status: 400 }
    );
  }
}
