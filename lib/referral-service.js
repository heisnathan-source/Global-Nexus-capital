import { getDb } from "./db.js";

export async function getOrCreateReferralCode(userId) {
  const db = getDb();

  /*
   * First check the current referral_codes table.
   * This is the main referral system used during registration.
   */
  const existing = await db.query(
    `
    SELECT code
    FROM referral_codes
    WHERE user_id = $1
    `,
    [userId]
  );

  if (existing.rowCount) {
    return existing.rows[0].code;
  }

  /*
   * Create a referral code if one does not exist.
   */
  const code =
    `CMC${String(userId)
      .replace(/-/g, "")
      .slice(0, 10)
      .toUpperCase()}`;

  const created = await db.query(
    `
    INSERT INTO referral_codes(user_id, code)
    VALUES($1, $2)
    ON CONFLICT(user_id)
    DO UPDATE SET code = referral_codes.code
    RETURNING code
    `,
    [userId, code]
  );

  return created.rows[0].code;
}


export async function qualifyDirectReferral(referredUserId) {
  const db = getDb();

  const result = await db.query(
    `
    SELECT
      id,
      rank_id
    FROM users
    WHERE id = $1
    `,
    [referredUserId]
  );

  if (!result.rowCount) {
    throw new Error("Referred user not found");
  }

  const user = result.rows[0];

  /*
   * A member becomes qualified when they have
   * successfully obtained a Global Nexus Capital rank.
   */
  if (!user.rank_id) {
    return {
      qualified: false,
      message: "Member has not purchased a Global Nexus Capital rank yet"
    };
  }

  const referral = await db.query(
    `
    UPDATE direct_referrals
    SET
      qualifying_status = 'starter_qualified',
      qualified_at = COALESCE(qualified_at, NOW())
    WHERE referred_user_id = $1
    RETURNING sponsor_user_id
    `,
    [referredUserId]
  );

  if (!referral.rowCount) {
    return {
      qualified: false,
      message: "Member has no direct sponsor"
    };
  }

  return {
    qualified: true,
    userId: referredUserId,
    sponsorUserId: referral.rows[0].sponsor_user_id
  };
}


/*
 * Get the user's direct referral team.
 *
 * IMPORTANT:
 * The database currently uses the internal status
 * "starter_qualified", but this represents a member
 * who has qualified by purchasing ANY valid Global Nexus Capital rank.
 *
 * The user interface should simply call them:
 * "Qualified Members".
 */
export async function getTeamSummary(userId) {
  const db = getDb();

  const summaryResult = await db.query(
    `
    SELECT
      COUNT(*)::int AS direct_members,

      COUNT(*) FILTER (
        WHERE
          qualifying_status = 'starter_qualified'
          OR qualified_at IS NOT NULL
      )::int AS qualifying_members

    FROM direct_referrals

    WHERE sponsor_user_id = $1
    `,
    [userId]
  );

  const summary = summaryResult.rows[0];

  const membersResult = await db.query(
    `
    SELECT
      dr.referred_user_id,

      u.name,
      u.phone,

      dr.qualifying_status,
      dr.qualified_at,
      dr.created_at,

      COALESCE(r.name, 'Not Qualified') AS rank_name,

      CASE
        WHEN
          dr.qualifying_status = 'starter_qualified'
          OR dr.qualified_at IS NOT NULL
        THEN TRUE
        ELSE FALSE
      END AS is_qualified

    FROM direct_referrals dr

    JOIN users u
      ON u.id = dr.referred_user_id

    LEFT JOIN ranks r
      ON r.id = u.rank_id

    WHERE dr.sponsor_user_id = $1

    ORDER BY
      dr.created_at DESC
    `,
    [userId]
  );

  return {
    directMembers: Number(summary.direct_members || 0),

    qualifyingMembers: Number(
      summary.qualifying_members || 0
    ),

    members: membersResult.rows
  };
}
