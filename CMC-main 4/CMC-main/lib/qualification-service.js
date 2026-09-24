import { getDb } from "./db.js";
import { processMemberEventRewards } from "./member-event-service.js";

/*
 * Global Nexus Capital REFERRAL QUALIFICATION RULE
 *
 * Purchasing ANY rank qualifies the user as a
 * qualifying direct referral for their sponsor.
 *
 * When a referral becomes qualified for the FIRST time,
 * the sponsor's active event rewards are immediately
 * checked and credited where requirements are reached.
 */
export async function qualifyReferralFromRankPurchase(
  userId,
  rankPurchaseId,
  rankId
) {
  const db = getDb();
  const client = await db.connect();

  let sponsorUserId = null;
  let qualificationCreated = false;
  let rankName = null;

  try {
    await client.query("BEGIN");

    const rank = await client.query(
      `
      SELECT name, rank_number
      FROM ranks
      WHERE id = $1
      `,
      [rankId]
    );

    if (!rank.rowCount) {
      throw new Error("Rank not found.");
    }

    rankName = rank.rows[0].name;

    /*
     * Record that this user became qualified through
     * a rank purchase.
     */
    const qualification = await client.query(
      `
      INSERT INTO qualification_events
        (
          user_id,
          qualification_type,
          source_type,
          source_id
        )
      VALUES
        (
          $1,
          'starter_qualified',
          'rank_purchase',
          $2
        )
      ON CONFLICT(user_id, qualification_type)
      DO NOTHING
      RETURNING id
      `,
      [
        userId,
        rankPurchaseId
      ]
    );

    qualificationCreated =
      qualification.rowCount > 0;

    /*
     * Update the user's direct referral relationship
     * and capture the sponsor.
     *
     * qualified_at is only set the FIRST time the user
     * qualifies. Events use this timestamp to determine
     * whether the qualification happened after an event
     * started.
     */
    const referral = await client.query(
      `
      UPDATE direct_referrals
      SET
        qualifying_status = 'starter_qualified',
        qualified_at = COALESCE(qualified_at, NOW())
      WHERE referred_user_id = $1
      RETURNING sponsor_user_id
      `,
      [userId]
    );

    if (referral.rowCount) {
      sponsorUserId =
        referral.rows[0].sponsor_user_id;
    }

    await client.query("COMMIT");

  } catch (error) {

    await client.query("ROLLBACK");
    throw error;

  } finally {

    client.release();
  }

  /*
   * IMPORTANT:
   * Process sponsor event rewards only AFTER the
   * qualification transaction has successfully committed.
   *
   * This ensures processMemberEventRewards can see the
   * newly qualified referral.
   */
  if (
    qualificationCreated &&
    sponsorUserId
  ) {
    await processMemberEventRewards(
      sponsorUserId
    );
  }

  return {
    qualified: true,
    created: qualificationCreated,
    rankName
  };
}
