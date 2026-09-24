# Global Nexus Capital Final Audit Fixes — 24 Aug 2026

This build fixes the issues identified during the current browser test.

## Fixed
- Fund Products: Admin now saves `period_days`, `min_purchase`, and `max_purchase` using the same database fields used by the user purchase flow.
- Fund Products: user/admin displays now use the same period and amount field names; product pictures remain connected through the Admin media upload.
- Events: added the missing `events.banner_url` database column and kept Admin event banner upload connected to user Events/Lucky Cards.
- Lucky Cards: added the missing `lucky_card_prizes` table and the draw table/indexes needed by the existing Lucky Card service.
- Deposits: removed the fixed GHS 100/200/500/1000/2000/5000 dropdown. Users can enter any positive amount; the existing Admin payment-pool assignment still chooses the payment account.
- Spin Games: added Admin game/prize management, image/banner upload, rank eligibility, maximum plays, weighted prizes, user spin page, user play recording, and Admin ON/OFF control.
- Home: added Spin Games to the user feature grid and a Spin button in the bottom navigation.
- Admin dashboard: added Spin Games module.
- Global Settings: added Spin Games ON/OFF control.

## Database step
The project includes:
- `db/patch_2026_08_24_final_audit.sql`
- `scripts/apply_final_audit_patch.mjs`

From the project directory, with the same `.env`/`DATABASE_URL` used by Global Nexus Capital:

`npm run db:final-audit`

Run this once before testing the affected pages.

## Validation
Node syntax checks passed for the modified JavaScript API/service files. A full Next.js production build could not be completed in this environment because the dependency installation timed out, so the final browser test should be done after applying the DB patch and running the normal Global Nexus Capital dev server.
