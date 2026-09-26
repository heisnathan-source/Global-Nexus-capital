import { getDb } from "./db.js";

export async function getFundProducts(){
 const db=getDb();
 return (await db.query(`
   SELECT id,name,description,image_url,interest_rate,period_days,min_purchase,max_purchase
   FROM fund_products WHERE active=TRUE ORDER BY display_order,name
 `)).rows;
}

export function calculateFundReturn(principal, rate){
 const p=Number(principal), r=Number(rate);
 if(!Number.isFinite(p)||p<=0||!Number.isFinite(r)||r<0) throw new Error("Invalid fund amount or rate.");
 const interest=Math.round(p*r)/100;
 return {principal:p,interest,maturityAmount:p+interest};
}

export async function purchaseFund(userId,productId,amount){
 const value=Number(amount);
 if(!Number.isFinite(value)||value<=0) throw new Error("Invalid purchase amount.");
 const db=getDb();
 const client=await db.connect();
 try{
  await client.query("BEGIN");
  const product=await client.query(`SELECT * FROM fund_products WHERE id=$1 AND active=TRUE FOR UPDATE`,[productId]);
  if(!product.rowCount) throw new Error("Fund product is unavailable.");
  const p=product.rows[0];
  if(value<Number(p.min_purchase)||(p.max_purchase!==null&&value>Number(p.max_purchase)))
    throw new Error("Amount is outside this fund product's configured range.");
  const wallet=await client.query("SELECT available_balance FROM wallets WHERE user_id=$1 FOR UPDATE",[userId]);
  if(!wallet.rowCount||Number(wallet.rows[0].available_balance)<value) throw new Error("Insufficient available balance.");
  const interest=Math.round(value*Number(p.interest_rate))/100;
  const maturity=value+interest;
  const maturityAt=new Date(Date.now()+Number(p.period_days)*86400000);
  const after=Number(wallet.rows[0].available_balance)-value;
  await client.query("UPDATE wallets SET available_balance=$1,updated_at=NOW() WHERE user_id=$2",[after,userId]);
  const purchase=await client.query(`
    INSERT INTO fund_purchases(user_id,fund_product_id,purchase_amount,interest_rate,expected_return,maturity_at)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId,productId,value,Number(p.interest_rate),maturity,maturityAt]);
  const tx=await client.query(`
    INSERT INTO transactions(user_id,type,amount,fee,status,reference,metadata)
    VALUES($1,'fund_purchase',$2,0,'successful',$3,$4) RETURNING id`,
    [userId,value,`FUND-${purchase.rows[0].id}`,JSON.stringify({fundProductId:productId})]);
  await client.query(`
    INSERT INTO wallet_ledger(user_id,transaction_id,entry_type,amount,balance_after,description)
    VALUES($1,$2,'fund_purchase',$3,$4,$5)`,
    [userId,tx.rows[0].id,-value,after,`Purchased ${p.name}`]);
  await client.query("COMMIT");
  return purchase.rows[0];
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
}
