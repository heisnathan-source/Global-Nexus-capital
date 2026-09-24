import { getDb } from "./db.js";

export async function creditDailyRankEarnings(earningDate = new Date()) {
  const db=getDb();
  const client=await db.connect();
  const credited=[];
  try {
    await client.query("BEGIN");

    const users=await client.query(`
      SELECT u.id AS user_id,r.id AS rank_id,
             r.name,rr.daily_earning,rr.division_count
      FROM users u
      JOIN ranks r ON r.id=u.rank_id
      JOIN rank_purchase_rules rr ON rr.rank_id=r.id
      WHERE u.enabled=TRUE AND r.active=TRUE
    `);

    for(const row of users.rows){
      const gross=Number(row.daily_earning||0);
      const divisions=Number(row.division_count||0);
      if(gross<=0 || divisions<=0) continue;

      const amount=Math.round((gross/divisions)*100)/100;
      if(amount<=0) continue;

      const existing=await client.query(`
        SELECT id FROM rank_earnings
        WHERE user_id=$1 AND rank_id=$2 AND earning_date=$3
        FOR UPDATE
      `,[row.user_id,row.rank_id,earningDate]);

      if(existing.rowCount) continue;

      const wallet=await client.query(`
        SELECT available_balance FROM wallets
        WHERE user_id=$1 FOR UPDATE
      `,[row.user_id]);
      if(!wallet.rowCount) continue;

      const after=Number(wallet.rows[0].available_balance)+amount;

      await client.query(`
        UPDATE wallets SET available_balance=$1,updated_at=NOW()
        WHERE user_id=$2
      `,[after,row.user_id]);

      const tx=await client.query(`
        INSERT INTO transactions
          (user_id,type,amount,fee,status,reference,metadata)
        VALUES($1,'rank_earning',$2,0,'successful',$3,$4)
        RETURNING id
      `,[
        row.user_id,amount,
        `RANK-EARN-${row.rank_id}-${String(earningDate)}`,
        JSON.stringify({
          rankId:row.rank_id,
          rankName:row.name,
          grossDailyEarning:gross,
          divisionCount:divisions,
          earningDate
        })
      ]);

      await client.query(`
        INSERT INTO wallet_ledger
          (user_id,transaction_id,entry_type,amount,balance_after,description)
        VALUES($1,$2,'rank_earning',$3,$4,$5)
      `,[
        row.user_id,tx.rows[0].id,amount,after,
        `Daily ${row.name} earning`
      ]);

      await client.query(`
        INSERT INTO rank_earnings
          (user_id,rank_id,earning_date,gross_amount,division_count,
           credited_amount,transaction_id)
        VALUES($1,$2,$3,$4,$5,$6,$7)
      `,[
        row.user_id,row.rank_id,earningDate,gross,divisions,amount,tx.rows[0].id
      ]);

      credited.push({
        userId:row.user_id,
        rank:row.name,
        amount
      });
    }

    await client.query("COMMIT");
    return credited;
  } catch(e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
