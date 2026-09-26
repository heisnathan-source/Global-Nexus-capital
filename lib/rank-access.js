import { getDb } from "./db.js";

/*
  Rank access rule:
  - No rank purchased: Rank 1 through the highest configured rank are available.
  - If a user has purchased Rank N, Rank 1..N are locked and Rank N+1..last are available.
  - Users may purchase only one rank at a time; the next purchase must be a higher rank.
  - Lower ranks never reopen after a higher rank is purchased.
*/
export async function getRankAccess(userId){
  const db=getDb();
  const ranks=(await db.query(`
    SELECT id,name,daily_earnings,commission_divisor,display_order
    FROM ranks WHERE active=TRUE ORDER BY display_order ASC
  `)).rows;

  const purchases=(await db.query(`
    SELECT rp.rank_id,r.display_order,r.name,rp.purchase_amount,rp.purchased_at
    FROM rank_purchases rp
    JOIN ranks r ON r.id=rp.rank_id
    WHERE rp.user_id=$1 AND rp.status IN ('active','completed')
    ORDER BY r.display_order DESC
  `,[userId])).rows;

  const highestOrder=purchases.length ? Number(purchases[0].display_order) : 0;

  return ranks.map(rank=>{
    const order=Number(rank.display_order);
    return {
      ...rank,
      purchased: order<=highestOrder,
      locked: order<=highestOrder,
      availableForPurchase: order>highestOrder,
      isNextPurchase: order===highestOrder+1
    };
  });
}
