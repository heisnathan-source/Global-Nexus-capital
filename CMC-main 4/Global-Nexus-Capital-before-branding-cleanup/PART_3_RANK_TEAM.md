# Global Nexus Capital Part 3 — Rank + Team Expansion

Implemented in this part only:
- User rank cards use rank-specific colours from `rank_purchase_rules.color_hex`.
- Added a rank banner that changes colour with the selected/swiped rank.
- Added left/right rank controls in addition to horizontal swiping.
- User-facing rank page does not display the commission divisor/division count.
- Admin Rank Management can load and save each rank's purchase price, daily earning, internal divisor, and colour.
- Admin colour validation requires a six-digit hex colour.
- Corrected the internal Supreme divisor default to 30 to match the Global Nexus Capital specification.
- Team Expansion exposes the user's unique referral link and QR code and keeps direct-team qualification separate.

Not claimed as production-ready: full Next.js/PostgreSQL integration still requires local dependency installation and a real staging database test.
