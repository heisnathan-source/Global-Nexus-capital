# Concurrency & Idempotency Audit

The audit found one issue: rank purchases did not have an explicit database uniqueness constraint/idempotent insert.

Fixed:
- Added UNIQUE(user_id, rank_id) to user_rank_purchases.
- Added ON CONFLICT handling in the rank purchase service.

This protects against duplicate rank purchase records during repeated/concurrent requests.

Static concurrency findings after fix: 0.

True concurrency testing still requires PostgreSQL staging with multiple simultaneous requests; source inspection cannot prove database behavior under load.
