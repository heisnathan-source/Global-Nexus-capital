import { getDb } from "./db.js";

export async function getManagementPositions(userId){
 const db=getDb();
 const positions=(await db.query(`
   SELECT id,name,required_direct_members,required_qualifying_members,cash_bonus,display_order
   FROM management_positions
   WHERE active=TRUE ORDER BY display_order
 `)).rows;

 const counts=(await db.query(`
   SELECT
     COUNT(*)::int AS direct_members,
     COUNT(*) FILTER (WHERE qualifying_status='starter_qualified')::int AS qualifying_members
   FROM direct_referrals
   WHERE sponsor_user_id=$1
 `,[userId])).rows[0];

 return positions.map(p=>{
   const direct=Number(counts.direct_members||0);
   const qualifying=Number(counts.qualifying_members||0);
   const eligible=direct>=Number(p.required_direct_members) &&
                  qualifying>=Number(p.required_qualifying_members);
   return {
     ...p,
     directMembers:direct,
     qualifyingMembers:qualifying,
     eligible,
     status:eligible?"eligible":"locked"
   };
 });
}
