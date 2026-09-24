import { getDb } from "./db.js";

export async function matureDueFunds() {
  const db=getDb();
  const client=await db.connect();
  const results=[];
  try {
    await client.query("BEGIN");
    const due=await client.query(`
      SELECT fp.*,u.id AS owner_id,p.name AS product_name
      FROM fund_purchases fp
      JOIN users u ON u.id=fp.user_id
      JOIN fund_products p ON p.id=fp.product_id
      WHERE fp.status='active' AND fp.maturity_at <= NOW()
      ORDER BY fp.maturity_at
      FOR UPDATE OF fp
    `);

    for(const f of due.rows){
      const exists=await client.query(
        "SELECT id FROM fund_maturity_ledger WHERE fund_purchase_id=$1 FOR UPDATE",
        [f.id]
      );
      if(exists.rowCount) {
        await client.query("UPDATE fund_purchases SET status='matured' WHERE id=$1",[f.id]);
        continue;
      }

      const wallet=await client.query(
        "SELECT available_balance FROM wallets WHERE user_id=$1 FOR UPDATE",
        [f.user_id]
      );
      if(!wallet.rowCount) throw new Error(`Wallet not found for fund ${f.id}.`);

      const before=Number(wallet.rows[0].available_balance);
      const after=before+Number(f.maturity_amount);

      await client.query(
        "UPDATE wallets SET available_balance=$1,updated_at=NOW() WHERE user_id=$2",
        [after,f.user_id]
      );

      const tx=await client.query(`
        INSERT INTO transactions
          (user_id,type,amount,fee,status,reference,metadata)
        VALUES($1,'fund_maturity',$2,0,'successful',$3,$4)
        RETURNING id
      `,[
        f.user_id,
        f.maturity_amount,
        `FUND-MATURITY-${f.id}`,
        JSON.stringify({
          fundPurchaseId:f.id,
          principal:f.principal_amount,
          interest:f.interest_amount,
          maturityAmount:f.maturity_amount
        })
      ]);

      await client.query(`
        INSERT INTO wallet_ledger
          (user_id,transaction_id,entry_type,amount,balance_after,description)
        VALUES($1,$2,'fund_maturity',$3,$4,$5)
      `,[
        f.user_id,tx.rows[0].id,f.maturity_amount,after,
        `Matured ${f.product_name}`
      ]);

      await client.query(`
        INSERT INTO fund_maturity_ledger
          (fund_purchase_id,user_id,principal_amount,interest_amount,maturity_amount,transaction_id)
        VALUES($1,$2,$3,$4,$5,$6)
      `,[
        f.id,f.user_id,f.principal_amount,f.interest_amount,
        f.maturity_amount,tx.rows[0].id
      ]);

      await client.query(
        "UPDATE fund_purchases SET status='matured' WHERE id=$1",
        [f.id]
      );

      results.push({fundPurchaseId:f.id,userId:f.user_id,maturityAmount:Number(f.maturity_amount)});
    }

    await client.query("COMMIT");
    return results;
  } catch(e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
