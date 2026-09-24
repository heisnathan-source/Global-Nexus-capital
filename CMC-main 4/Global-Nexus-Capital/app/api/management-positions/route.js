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

export async function GET(request) {
  const session = getUserSession(request);

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();

    const result = await db.query(
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
        mp.active,

        COUNT(DISTINCT dr.referred_user_id)::int
          AS direct_members,

        COUNT(DISTINCT dr.referred_user_id)
          FILTER (
            WHERE dr.qualifying_status =
              'starter_qualified'
          )::int AS qualifying_members

      FROM management_positions mp

      LEFT JOIN direct_referrals dr
        ON dr.sponsor_user_id = $1

      WHERE mp.active = TRUE

      GROUP BY
        mp.id,
        mp.name,
        mp.required_direct_members,
        mp.required_qualifying_members,
        mp.salary_amount,
        mp.payment_interval_months,
        mp.cash_bonus,
        mp.display_order,
        mp.active

      ORDER BY mp.display_order, mp.id
      `,
      [session.userId]
    );

    const positions = result.rows.map(
      (position) => {
        const directMembers =
          Number(position.direct_members || 0);

        const qualifyingMembers =
          Number(
            position.qualifying_members || 0
          );

        const requiredDirect =
          Number(
            position.required_direct_members || 0
          );

        const requiredQualifying =
          Number(
            position.required_qualifying_members || 0
          );

        const eligible =
          directMembers >= requiredDirect &&
          qualifyingMembers >= requiredQualifying;

        return {
          ...position,
          directMembers,
          qualifyingMembers,
          eligible,
          status: eligible
            ? "eligible"
            : "locked"
        };
      }
    );

    return Response.json({ positions });
  } catch (error) {
    console.error(
      "Management positions GET failed:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load management positions."
      },
      { status: 500 }
    );
  }
}
