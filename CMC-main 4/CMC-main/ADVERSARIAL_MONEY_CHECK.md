# Adversarial Money/Security Check

Found and fixed:
- Deposit endpoint trusted a client-supplied user ID header; now uses signed user session.
- Referral registration accepted an arbitrary newUserId; now derives the referred user from the signed session.
- Referral commission credits lacked a wallet ledger entry; fixed.
- Legacy withdrawal approval path lacked a ledger record; fixed.

Final static/adversarial findings: 0.

Remaining validation requires a real staging database and concurrency tests.
