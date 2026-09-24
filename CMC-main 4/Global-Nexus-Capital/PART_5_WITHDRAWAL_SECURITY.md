Global Nexus Capital Part 5 — Withdrawal + Account Security

Implemented:
- First-time withdrawal gate creates a 6-digit numeric Funds Password.
- Funds Password is bcrypt-hashed and never returned to Admin.
- First-time withdrawal also requires government/legal name + ID verification.
- Admin can view pending identity verification requests and approve/reject them.
- Withdrawal is blocked until identity verification is approved.
- Admin withdrawal settings are persisted: global ON/OFF, unavailable message, fee mode/value, processing range, global days, rank-specific days.
- User service charge and net amount now read the configured Admin fee values.
- Withdrawal amount choices remain Admin-configured.
- Backend rechecks all rules, balance, password, amount and 24-hour limit in a transaction.
- Global and rank-specific day rules are both enforced.

Safety note:
Do not use real money. Production requires PostgreSQL staging tests, payment reconciliation, concurrency tests, rollback tests and provider/compliance review.
