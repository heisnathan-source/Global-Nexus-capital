import { randomUUID } from "crypto";
import { getDb } from "./db.js";

export async function createDeposit({ userId, amount, metadata = {} }) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const user = await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    if (!user.rowCount) throw new Error("User not found");

    const reference = `DEP-${randomUUID()}`;
    const result = await client.query(`
      INSERT INTO transactions
        (user_id,type,amount,fee,status,reference,metadata)
      VALUES ($1,'deposit',$2,0,'pending',$3,$4)
      RETURNING id,reference,status,amount,created_at
    `, [userId, amount, reference, JSON.stringify(metadata)]);

    await client.query("COMMIT");
    return result.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function confirmDeposit({ transactionId, adminUserId }) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const tx = await client.query(`
      SELECT id,user_id,amount,status,reference
      FROM transactions
      WHERE id=$1
      FOR UPDATE
    `, [transactionId]);

    if (!tx.rowCount) throw new Error("Transaction not found");
    const row = tx.rows[0];
    if (row.status !== "pending") throw new Error("Transaction is no longer pending");

    const wallet = await client.query(
      "SELECT user_id FROM wallets WHERE user_id=$1 FOR UPDATE",
      [row.user_id]
    );
    if (!wallet.rowCount) throw new Error("Wallet not found");

    await client.query(
      "UPDATE wallets SET available_balance=available_balance+$1, updated_at=NOW() WHERE user_id=$2",
      [row.amount, row.user_id]
    );

    await client.query(`
      INSERT INTO wallet_ledger
        (user_id,transaction_id,entry_type,amount,balance_after,description)
      SELECT $1,$2,'deposit',$3,w.available_balance,
             'Verified deposit'
      FROM wallets w WHERE w.user_id=$1
    `,[row.user_id,row.id,row.amount]);

    await client.query(
      "UPDATE transactions SET status='successful',updated_at=NOW() WHERE id=$1",
      [row.id]
    );

    await client.query(`
      INSERT INTO audit_logs
        (id,admin_user_id,action,entity_type,entity_id,new_value)
      VALUES ($1,$2,'confirm_deposit','transaction',$3,$4)
    `, [randomUUID(), adminUserId, row.id, JSON.stringify({status:"successful", reference:row.reference})]);

    await client.query("COMMIT");
    return {...row, status:"successful"};
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function createWithdrawal({ userId, amount, fee, metadata = {} }) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const wallet = await client.query(`
      SELECT available_balance
      FROM wallets
      WHERE user_id=$1
      FOR UPDATE
    `, [userId]);

    if (!wallet.rowCount) throw new Error("Wallet not found");
    if (Number(wallet.rows[0].available_balance) < Number(amount)) {
      throw new Error("Insufficient available balance");
    }

    const reference = `WDR-${randomUUID()}`;

    // Reserve the requested amount while the withdrawal is pending.
    await client.query(`
      UPDATE wallets
      SET available_balance=available_balance-$1,
          reserved_balance=reserved_balance+$1,
          updated_at=NOW()
      WHERE user_id=$2
    `, [amount, userId]);

    const result = await client.query(`
      INSERT INTO transactions
        (user_id,type,amount,fee,status,reference,metadata)
      VALUES ($1,'withdrawal',$2,$3,'pending',$4,$5)
      RETURNING id,reference,status,amount,fee,created_at
    `, [userId, amount, fee, reference, JSON.stringify(metadata)]);

    await client.query("COMMIT");
    return result.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function rejectWithdrawal({ transactionId, adminUserId, reason = "" }) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const tx = await client.query(`
      SELECT id,user_id,amount,status,reference
      FROM transactions
      WHERE id=$1 AND type='withdrawal'
      FOR UPDATE
    `, [transactionId]);

    if (!tx.rowCount) throw new Error("Withdrawal not found");
    const row = tx.rows[0];
    if (row.status !== "pending") throw new Error("Withdrawal is no longer pending");

    await client.query(`
      UPDATE wallets
      SET available_balance=available_balance+$1,
          reserved_balance=reserved_balance-$1,
          updated_at=NOW()
      WHERE user_id=$2
    `, [row.amount, row.user_id]);

    await client.query(`
      INSERT INTO wallet_ledger
        (user_id,transaction_id,entry_type,amount,balance_after,description)
      SELECT $1,$2,'withdrawal_refund',$3,w.available_balance,
             'Rejected withdrawal refunded'
      FROM wallets w WHERE w.user_id=$1
    `,[row.user_id,row.id,row.amount]);

    await client.query(`
      UPDATE transactions
      SET status='rejected',
          metadata=metadata || $1::jsonb,
          updated_at=NOW()
      WHERE id=$2
    `, [JSON.stringify({rejectionReason: reason}), row.id]);

    await client.query(`
      INSERT INTO audit_logs
        (id,admin_user_id,action,entity_type,entity_id,new_value,reason)
      VALUES ($1,$2,'reject_withdrawal','transaction',$3,$4,$5)
    `, [randomUUID(), adminUserId, row.id, JSON.stringify({status:"rejected"}), reason]);

    await client.query("COMMIT");
    return {...row, status:"rejected"};
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
