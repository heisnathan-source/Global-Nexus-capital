import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  USER_COOKIE_NAME
} from "@/lib/session.js";
import { getWithdrawalPolicy } from "@/lib/withdrawal-policy.js";

function getUserSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${USER_COOKIE_NAME}=([^;]+)`)
  );

  if (!match) return null;

  return verifySessionToken(match[1]);
}

export async function GET(request) {
  const s = getUserSession(request);

  if (!s || !s.userId || s.role !== "user") {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = getDb();
    const p = await getWithdrawalPolicy(s.userId);

    const rankName = p.rankName || null;

    // Global amounts:
    // An amount is global when it has no active rank assignment.
    const globalRows = (
      await db.query(`
        SELECT
          wa.id,
          wa.amount,
          wa.display_order
        FROM withdrawal_amounts wa
        WHERE wa.active = TRUE
          AND NOT EXISTS (
            SELECT 1
            FROM withdrawal_amount_rank_assignments wra
            WHERE wra.withdrawal_amount_id = wa.id
              AND wra.active = TRUE
          )
        ORDER BY wa.display_order, wa.amount
      `)
    ).rows;

    // Rank-specific amounts:
    // Only amounts assigned to the user's current rank.
    let rankRows = [];

    if (rankName) {
      rankRows = (
        await db.query(
          `
          SELECT
            wa.id,
            wa.amount,
            wa.display_order
          FROM withdrawal_amounts wa
          INNER JOIN withdrawal_amount_rank_assignments wra
            ON wra.withdrawal_amount_id = wa.id
          WHERE wa.active = TRUE
            AND wra.active = TRUE
            AND wra.rank_name = $1
          ORDER BY wa.display_order, wa.amount
          `,
          [rankName]
        )
      ).rows;
    }

    // Prevent duplicate amounts if the same amount somehow
    // appears in both global and rank-specific results.
    const seen = new Set();

    const amounts = [
      ...rankRows,
      ...globalRows
    ]
      .filter(row => {
        const key = String(row.id);

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .map(row => Number(row.amount));

    return Response.json({
      amounts,
      allowed: p.allowed,
      reason: p.allowed ? null : p.reason || null,

      feeMode: p.feeMode || null,
      feeValue: Number(p.feeValue || 0),

      processingMinHours: Number(
        p.processingMinHours || 0
      ),

      processingMaxHours: Number(
        p.processingMaxHours || 48
      ),

      rankName
    });
  } catch (error) {
    console.error(
      "Withdrawal options error:",
      error
    );

    return Response.json(
      {
        error: "Unable to load withdrawal options."
      },
      { status: 500 }
    );
  }
}
