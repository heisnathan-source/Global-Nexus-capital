import { getDb } from "@/lib/db.js";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/session.js";

function adminSession(request){
 const c=request.headers.get("cookie")||"";
 const m=c.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
 const s=m?verifySessionToken(m[1]):null;
 return s&&s.role==="admin"?s:null;
}

export async function POST(request){
 const admin=adminSession(request);
 if(!admin) return Response.json({error:"Unauthorized"},{status:401});

 const {orderId,action,reason}=await request.json();
 if(!orderId || !["verify","reject"].includes(action))
   return Response.json({error:"Valid order and action are required."},{status:400});

 const db=getDb();
 const client=await db.connect();
 try {
   await client.query("BEGIN");

   const q=await client.query(`
     SELECT id,user_id,amount,wallet_id,status
     FROM deposit_orders
     WHERE id=$1
     FOR UPDATE
   `,[orderId]);
   if(!q.rowCount) throw new Error("Deposit order not found.");
   const order=q.rows[0];

   if(order.status==="verified")
     throw new Error("Deposit has already been verified.");
   if(!["payment_submitted","awaiting_payment"].includes(order.status))
     throw new Error("Deposit is not in a verifiable state.");

   if(action==="reject"){
     await client.query(`
       UPDATE deposit_orders
       SET status='rejected',verified_at=NOW(),verified_by=$2
       WHERE id=$1
     `,[orderId,admin.userId]);

     if(order.wallet_id)
       await client.query("UPDATE payment_wallet_pool SET in_use=FALSE WHERE id=$1",[order.wallet_id]);

     await client.query(`
       INSERT INTO admin_actions(admin_user_id,action_type,target_type,target_id,reason)
       VALUES($1,'deposit_rejected','deposit',$2,$3)
     `,[admin.userId,orderId,reason||"Payment not verified"]);

     await client.query("COMMIT");
     return Response.json({status:"rejected"});
   }

   // Idempotent wallet credit inside the same database transaction.
   const wallet=await client.query(`
     SELECT available_balance FROM wallets WHERE user_id=$1 FOR UPDATE
   `,[order.user_id]);
   if(!wallet.rowCount) throw new Error("User wallet not found.");

   const after=Number(wallet.rows[0].available_balance)+Number(order.amount);
   await client.query(`
     UPDATE wallets SET available_balance=$1,updated_at=NOW() WHERE user_id=$2
   `,[after,order.user_id]);

   const tx=await client.query(`
     INSERT INTO transactions
       (user_id,type,amount,fee,status,reference,metadata)
     VALUES($1,'deposit',$2,0,'successful',$3,$4)
     RETURNING id
   `,[order.user_id,order.amount,`DEP-${order.id}`,JSON.stringify({depositOrderId:order.id,verifiedBy:admin.userId})]);

   await client.query(`
     INSERT INTO wallet_ledger
       (user_id,transaction_id,entry_type,amount,balance_after,description)
     VALUES($1,$2,'deposit',$3,$4,'Verified deposit')
   `,[order.user_id,tx.rows[0].id,order.amount,after]);

   await client.query(`
     UPDATE deposit_orders
     SET status='verified',verified_at=NOW(),verified_by=$2
     WHERE id=$1
   `,[orderId,admin.userId]);

   if(order.wallet_id)
     await client.query("UPDATE payment_wallet_pool SET in_use=FALSE WHERE id=$1",[order.wallet_id]);

   await client.query(`
     INSERT INTO admin_actions(admin_user_id,action_type,target_type,target_id,metadata)
     VALUES($1,'deposit_verified','deposit',$2,$3)
   `,[admin.userId,orderId,JSON.stringify({amount:order.amount,userId:order.user_id})]);

   await client.query("COMMIT");
   return Response.json({status:"verified",balanceAfter:after});
 } catch(e) {
   await client.query("ROLLBACK");
   return Response.json({error:e.message},{status:400});
 } finally { client.release(); }
}

export async function GET(request){ const admin=adminSession(request); if(!admin)return Response.json({error:"Unauthorized"},{status:401}); const db=getDb(); const r=await db.query(`SELECT id,user_id,amount,status,created_at FROM deposit_orders WHERE status IN ('payment_submitted','awaiting_payment') ORDER BY created_at ASC`); return Response.json({orders:r.rows}); }
