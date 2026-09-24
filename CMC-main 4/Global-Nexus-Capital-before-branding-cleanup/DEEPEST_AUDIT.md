# Deepest Independent Audit

New defects found and fixed in this pass:
1. Duplicate rank purchase endpoint bypassed the canonical rank service and used a different table (`rank_purchases`), creating a split purchase state and allowing inconsistent rank history.
2. Duplicate `/api/deposits` endpoint created standalone pending transactions instead of canonical `deposit_orders`, creating a second deposit flow.
3. Duplicate admin deposit confirmation endpoint could credit those standalone transactions separately from the canonical deposit-order verification path.
4. Account-security API used `id_number` while the database uses `government_id_number`.
5. Identity verification needed a unique user constraint for the API's upsert.
6. Rank 9 / SUPREME division configuration conflicted (30 vs 25); aligned to 25.
7. Duplicate withdrawal-refund transaction type in the schema constraint removed.

Static errors after these fixes: 0.
