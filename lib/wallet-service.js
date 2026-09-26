import { getDb } from "./db.js";

export async function postWalletEntry({
  userId,
  type,
  amount,
  description,
  reference,
  metadata = {}
}) {
  const value=Number(amount);
  if(!Number.isFinite(value) || value===0) throw new Error("Invalid wallet amount.");

  const db=getDb();
  const client=await db.connect();
  try {
    await client.query("BEGIN");

    const wallet=await client.query(`
      SELECT available_balance
      FROM wallets
      WHERE user_id=$1
      FOR UPDATE
    `,[userId]);
    if(!wallet.rowCount) throw new Error("Wallet not found.");

    const before=Number(wallet.rows[0].available_balance);
    const after=before+value;
    if(after<0) throw new Error("Insufficient wallet balance.");

    await client.query(`
      UPDATE wallets
      SET available_balance=$1,updated_at=NOW()
      WHERE user_id=$2
    `,[after,userId]);

    const tx=await client.query(`
      INSERT INTO transactions
        (user_id,type,amount,fee,status,reference,metadata)
      VALUES($1,$2,$3,0,'successful',$4,$5)
      RETURNING id
    `,[userId,type,Math.abs(value),reference,JSON.stringify({...metadata,direction:value>0?"credit":"debit"})]);

    await client.query(`
      INSERT INTO wallet_ledger
        (user_id,transaction_id,entry_type,amount,balance_after,description)
      VALUES($1,$2,$3,$4,$5,$6)
    ` ,[
      userId,
      tx.rows[0].id,
      value > 0 ? "credit" : "debit",
      Math.abs(value),
      after,
      description
    ]);

    await client.query("COMMIT");
    return {transactionId:tx.rows[0].id,balanceAfter:after};
  } catch(e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
}
