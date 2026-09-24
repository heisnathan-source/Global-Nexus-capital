import crypto from "crypto";
import { getDb } from "./db.js";

export async function getOrCreateReferralCode(userId) {
  const db=getDb();
  const existing=await db.query("SELECT code FROM referral_codes WHERE user_id=$1",[userId]);
  if(existing.rowCount) return existing.rows[0].code;

  for(let attempt=0;attempt<5;attempt++){
    const code=`CMC${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    try{
      const result=await db.query(
        "INSERT INTO referral_codes(user_id,code) VALUES($1,$2) RETURNING code",
        [userId,code]
      );
      return result.rows[0].code;
    }catch(e){
      if(e.code!=="23505") throw e;
    }
  }
  throw new Error("Unable to generate a unique referral code.");
}
