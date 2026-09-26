import { getDb } from "./db.js";

export async function detectNetwork(paymentNumber) {
  const prefix = String(paymentNumber).replace(/\D/g,"").slice(0,3);
  const db=getDb();
  const {rows}=await db.query(
    "SELECT network FROM network_prefixes WHERE prefix=$1 AND active=TRUE LIMIT 1",
    [prefix]
  );
  return rows[0]?.network ?? null;
}

export async function assignPaymentAccount(amount, network) {
  const db=getDb();
  const client=await db.connect();
  try{
    await client.query("BEGIN");
    const {rows}=await client.query(`
      SELECT id,network,payment_number,recipient_name,min_amount,max_amount
      FROM payment_accounts
      WHERE active=TRUE
        AND network=$1
        AND min_amount <= $2
        AND (max_amount IS NULL OR max_amount >= $2)
      ORDER BY display_order ASC, random()
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `,[network,amount]);
    if(!rows.length) throw new Error("No eligible payment account is currently available.");
    await client.query("COMMIT");
    return rows[0];
  }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
}
