import { getDb } from "@/lib/db.js";

export async function GET(){
  try {
    const db=getDb();
    const r=await db.query(`SELECT id,amount FROM deposit_amount_options WHERE active=TRUE ORDER BY sort_order ASC, amount ASC`);
    return Response.json({amounts:r.rows.map(x=>Number(x.amount))});
  } catch(e){ return Response.json({error:"Unable to load deposit amounts."},{status:500}); }
}
