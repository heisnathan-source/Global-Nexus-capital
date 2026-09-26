import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME,
} from "@/lib/session.js";

function getUserSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session && session.role === "user"
    ? session
    : null;
}

async function getContract(client, userId) {
  const result = await client.query(
    `
    SELECT
      mc.id,
      mc.user_id,
      mc.position_id,
      mc.qualifying_member_count,
      mc.status,
      mc.started_at,
      mc.terminated_at,
      mc.next_payment_at,
      mc.payments_received,
      mc.last_member_count,
      mc.qualification_snapshot_at,

      mp.name AS position_name,
      mp.required_direct_members,
      mp.required_qualifying_members,
      mp.salary_amount,
      mp.payment_interval_months,
      mp.cash_bonus

    FROM management_contracts mc

    JOIN management_positions mp
      ON mp.id = mc.position_id

    WHERE mc.user_id = $1
      AND mc.status = 'active'

    ORDER BY mc.started_at DESC
    LIMIT 1

    FOR UPDATE OF mc
    `,
    [userId]
  );

  return result;
}

export async function GET(request) {
  const session = getUserSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    /*
      Lock the current user so contract creation and the
      qualification snapshot cannot race against another
      management-status request.
    */
    const userResult = await client.query(
      `
      SELECT
        id,
        name,
        account_id,
        role,
        enabled
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [session.userId]
    );

    if (
      !userResult.rowCount ||
      userResult.rows[0].role !== "user" ||
      userResult.rows[0].enabled !== true
    ) {
      await client.query("ROLLBACK");

      return Response.json(
        { error: "Account unavailable." },
        { status: 403 }
      );
    }

    /*
      First look for an existing active contract.
    */
    let contractResult = await getContract(
      client,
      session.userId
    );

    /*
      If there is no active contract, determine whether the
      user qualifies for the highest configured active position.

      A valid direct member must:
        - be linked through direct_referrals
        - be role=user
        - be enabled=true

      A valid qualifying member must additionally have:
        - qualifying_status='starter_qualified'
    */
    if (!contractResult.rowCount) {
      const eligibleResult = await client.query(
        `
        SELECT
          mp.id,
          mp.name,
          mp.required_direct_members,
          mp.required_qualifying_members,
          mp.salary_amount,
          mp.payment_interval_months,
          mp.cash_bonus,
          mp.display_order,

          COUNT(DISTINCT referred.id)::int
            AS direct_members,

          COUNT(DISTINCT referred.id)
            FILTER (
              WHERE dr.qualifying_status =
                'starter_qualified'
            )::int AS qualifying_members

        FROM management_positions mp

        LEFT JOIN direct_referrals dr
          ON dr.sponsor_user_id = $1

        LEFT JOIN users referred
          ON referred.id = dr.referred_user_id
         AND referred.role = 'user'
         AND referred.enabled = TRUE

        WHERE mp.active = TRUE

        GROUP BY
          mp.id,
          mp.name,
          mp.required_direct_members,
          mp.required_qualifying_members,
          mp.salary_amount,
          mp.payment_interval_months,
          mp.cash_bonus,
          mp.display_order

        HAVING
          COUNT(DISTINCT referred.id)
            >= mp.required_direct_members

          AND

          COUNT(DISTINCT referred.id)
            FILTER (
              WHERE dr.qualifying_status =
                'starter_qualified'
            )
            >= mp.required_qualifying_members

        ORDER BY
          mp.display_order DESC,
          mp.id DESC

        LIMIT 1
        `,
        [session.userId]
      );

      if (eligibleResult.rowCount) {
        const position = eligibleResult.rows[0];

        /*
          Snapshot the qualifying count when the contract begins.

          The contract starts with payment #1 due immediately.
          The management payment processor is responsible for
          the actual atomic payment.
        */
        const createdResult = await client.query(
          `
          INSERT INTO management_contracts (
            user_id,
            position_id,
            qualifying_member_count,
            status,
            started_at,
            next_payment_at,
            payments_received,
            last_member_count,
            qualification_snapshot_at
          )
          VALUES (
            $1,
            $2,
            $3,
            'active',
            NOW(),
            NOW(),
            0,
            $3,
            NOW()
          )
          ON CONFLICT DO NOTHING
          RETURNING id
          `,
          [
            session.userId,
            position.id,
            Number(position.qualifying_members || 0),
          ]
        );

        /*
          Whether this request created the contract or another
          concurrent request created it, load the canonical
          active contract.
        */
        if (createdResult.rowCount) {
          contractResult = await getContract(
            client,
            session.userId
          );
        } else {
          contractResult = await getContract(
            client,
            session.userId
          );
        }
      }
    }

    /*
      Current valid team counts.
    */
    const countResult = await client.query(
      `
      SELECT
        COUNT(DISTINCT referred.id)::int AS direct_members,

        COUNT(DISTINCT referred.id)
          FILTER (
            WHERE dr.qualifying_status =
              'starter_qualified'
          )::int AS qualifying_members

      FROM direct_referrals dr

      JOIN users referred
        ON referred.id = dr.referred_user_id
       AND referred.role = 'user'
       AND referred.enabled = TRUE

      WHERE dr.sponsor_user_id = $1
      `,
      [session.userId]
    );

    const counts = countResult.rows[0] || {};

    /*
      Salary payment history for this user.
    */
    const historyResult = await client.query(
      `
      SELECT
        mp.id,
        mp.cycle_number,
        mp.amount,
        mp.status,
        mp.scheduled_at,
        mp.paid_at,
        mp.contract_id

      FROM management_payments mp

      JOIN management_contracts mc
        ON mc.id = mp.contract_id

      WHERE mc.user_id = $1

      ORDER BY
        mp.cycle_number DESC,
        mp.scheduled_at DESC

      LIMIT 30
      `,
      [session.userId]
    );

    /*
      Only paid management payments count toward total earnings.
    */
    const earningsResult = await client.query(
      `
      SELECT
        COALESCE(SUM(mp.amount), 0) AS total

      FROM management_payments mp

      JOIN management_contracts mc
        ON mc.id = mp.contract_id

      WHERE mc.user_id = $1
        AND mp.status = 'paid'
      `,
      [session.userId]
    );

    await client.query("COMMIT");

    const contract =
      contractResult.rows[0] || null;

    return Response.json({
      team: {
        directMembers:
          Number(counts.direct_members || 0),

        qualifyingMembers:
          Number(counts.qualifying_members || 0),
      },

      contract: contract
        ? {
            ...contract,

            payments_received:
              Number(
                contract.payments_received || 0
              ),

            qualifying_member_count:
              Number(
                contract.qualifying_member_count || 0
              ),

            last_member_count:
              Number(
                contract.last_member_count || 0
              ),

            salary_amount:
              Number(
                contract.salary_amount || 0
              ),

            payment_interval_months:
              Number(
                contract.payment_interval_months || 2
              ),

            cash_bonus:
              Number(
                contract.cash_bonus || 0
              ),
          }
        : null,

      totalEarned:
        Number(
          earningsResult.rows[0]?.total || 0
        ),

      paymentHistory:
        historyResult.rows.map((row) => ({
          ...row,
          amount: Number(row.amount || 0),
        })),
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "Management status failed:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load management status.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
