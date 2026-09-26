import { getDb } from "./db.js";

export async function evaluateReferralSalaryContracts(now=new Date()){
 const db=getDb();
 const client=await db.connect();
 const results=[];
 try{
  await client.query("BEGIN");

  const contracts=await client.query(`
    SELECT c.*,u.id AS owner_id,
           COALESCE((SELECT COUNT(*) FROM direct_referrals d
             WHERE d.sponsor_user_id=u.id AND d.qualifying_status='starter_qualified'),0)::int AS current_members
    FROM referral_salary_contracts c
    JOIN users u ON u.id=c.user_id
    WHERE c.status='active' AND c.next_payment_at IS NOT NULL
      AND c.next_payment_at<=NOW()
    FOR UPDATE OF c
  `);

  for(const c of contracts.rows){
    const paymentNo=Number(c.payments_received)+1;
    const currentMembers=Number(c.current_members);

    // The first two cycles pay normally. From the third cycle onward,
    // continuous member growth is required.
    const growthRequired=paymentNo>=3;
    const hasGrowth=currentMembers>Number(c.members_at_activation);

    if(growthRequired && !hasGrowth){
      await client.query(`
        UPDATE referral_salary_contracts
        SET status='terminated',terminated_at=NOW()
        WHERE id=$1
      `,[c.id]);

      await client.query(`
        INSERT INTO referral_salary_payments
          (contract_id,user_id,payment_number,amount,status,scheduled_at)
        VALUES($1,$2,$3,0,'skipped',NOW())
        ON CONFLICT(contract_id,payment_number) DO NOTHING
      `,[c.id,c.user_id,paymentNo]);

      results.push({userId:c.user_id,status:"terminated",paymentNumber:paymentNo});
      continue;
    }

    // Salary amount is intentionally sourced from the contract/commission
    // configuration rather than a hard-coded UI value.
    const salaryQ=await client.query(`
      SELECT COALESCE(SUM(amount),0) AS amount
      FROM referral_salary_entitlements
      WHERE user_id=$1 AND active=TRUE
    `,[c.user_id]);
    const amount=Number(salaryQ.rows[0]?.amount||0);

    if(amount<=0) throw new Error(`No active salary entitlement for user ${c.user_id}.`);

    const scheduled=await client.query(`
      INSERT INTO referral_salary_payments
        (contract_id,user_id,payment_number,amount,status,scheduled_at)
      VALUES($1,$2,$3,$4,'pending',$5)
      ON CONFLICT(contract_id,payment_number) DO UPDATE
      SET amount=EXCLUDED.amount
      RETURNING id
    `,[c.id,c.user_id,paymentNo,amount,c.next_payment_at]);

    const tx=await client.query(
      "SELECT public.process_referral_salary_payment($1) AS transaction_id",
      [scheduled.rows[0].id]
    );

    await client.query(`
      UPDATE referral_salary_contracts
      SET payments_received=$2,
          members_at_activation=$3,
          next_payment_at=NOW()+($4 || ' months')::interval
      WHERE id=$1
    `,[c.id,paymentNo,currentMembers,c.cycle_months]);

    results.push({userId:c.user_id,status:"paid",paymentNumber:paymentNo,amount});
  }

  await client.query("COMMIT");
  return results;
 }catch(e){
  await client.query("ROLLBACK");
  throw e;
 }finally{client.release();}
}
