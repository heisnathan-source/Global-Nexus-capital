# Global Nexus Capital Platform — Foundation + Shared Transaction Layer

This project now contains:
- Mobile-first Global Nexus Capital user shell
- Mine and financial pages
- Admin dashboard shell
- Shared PostgreSQL production schema foundation
- Wallet and transaction records
- Withdrawal-rule validation utilities
- Fee calculation utility
- Network/payment-account tables
- Identity-verification tables
- Audit-log tables
- Basic API health/transaction endpoints

## Important architecture
The PostgreSQL schema is the intended shared data model for both User and Admin applications.

The current API transaction route is only a local development scaffold. It must be replaced with authenticated PostgreSQL persistence before production deployment. No real customer funds should be processed through the in-memory scaffold.

## Local run
npm install
npm run dev

## Database
Apply db/schema.sql to the eventual PostgreSQL database.

## Next implementation
1. Authentication and authorization
2. Real PostgreSQL connection
3. Wallet transaction service with DB locking/idempotency
4. Admin deposit/withdrawal controls
5. User/Admin identity verification workflow
6. Fund product persistence
7. Remaining Global Nexus Capital modules


## Security implementation notes
- Login passwords are never returned to the UI.
- Admin reset flows should use expiring, single-use reset tokens.
- Funds Password resets should require protected Admin authorization and identity verification.
- Admin financial actions must be authenticated, authorized, idempotent and audited.
- The current development transaction API is not a production payment endpoint.


## Latest data-layer additions
The schema now includes persistent records for:
- Events
- Lucky Card prizes and draws
- Points accounts and ledger
- Rewards and redemptions
- Management positions
- Management contracts and payment cycles

Read-only API foundations are included for events, user points and direct referrals.


## Latest transaction layer
Implemented server-side transaction-service foundations for:
- Creating pending deposits
- Admin-confirming deposits and crediting wallets atomically
- Creating pending withdrawals while reserving wallet balance
- Rejecting withdrawals and releasing reserved funds
- Audit logging for Admin deposit confirmation and withdrawal rejection
- PostgreSQL row locking around wallet/transaction updates

Before production, the API authentication/session layer must replace the temporary development identity headers, and the remaining withdrawal-day/24-hour/idempotency checks must be enforced in the same database transaction.


## Latest authentication and withdrawal security layer
- Password login uses bcrypt hash comparison.
- Sessions use an HttpOnly/Secure cookie with an HMAC-signed payload.
- User withdrawal requests require an authenticated user session.
- Funds Password is exactly six digits and is bcrypt-verified.
- Identity approval is required.
- Withdrawal ON/OFF, allowed days, one-per-24-hours, balance, and fee settings are checked server-side.
- Admin withdrawal approve/reject routes require an Admin session.
- Successful/rejected withdrawal transitions are performed with row locking and audit records.

For production, use a vetted session/authentication framework and rotate secrets; do not expose development identity headers.


## Latest Admin operations
Added database-backed Admin API foundations for:
- User search
- Login-password reset without exposing the old password
- 6-digit Funds Password reset without exposing the old password
- Deposit confirmation/rejection
- Audit logging of Admin credential and deposit actions

Temporary generated credentials are returned only to the authenticated Admin API caller and should be delivered through a controlled UI with forced-change/reset policy before production.


## Latest deposit payment-pool layer
Added:
- Admin payment-account pool UI
- Network-prefix matching utility
- Automatic eligible payment-account assignment by network and amount limits
- Deposit request persistence including assigned account and status
- User payment screen
- User verification screen with 2-minute refresh cooldown display

Before production, connect the assignment and refresh actions to authenticated database transactions and payment-provider/reconciliation workflows.


## Latest Fund Products layer
Added persistent fund products and purchases:
- Admin-editable name, picture URL/upload field, interest rate, period and purchase limits
- Active/inactive product state
- User purchase records with the rate locked at purchase time
- Expected return and maturity timestamp
- Wallet debit and fund-purchase transaction in one database transaction
- User/API listing of active products


## Latest Task Management layer
Added persistent:
- Task sets by rank
- Commission per task
- Daily task limits
- Questions, images and correct answers
- User task attempts
- Task earnings credited to wallet
- Revenue transaction records

Also updated the UI shell so content-heavy pages remain vertically scrollable instead of being trapped in fixed-height screens.


## Latest referral/position qualification layer
- Direct referral records are persistent and unique per referred account.
- A registered referral remains non-qualifying until a verified fund purchase exists.
- Qualification is updated server-side.
- Management status counts only direct `starter_qualified` referrals.
- Contract/payment history remains separate from the current member count so termination does not erase historical records.
- User Team Expansion and Management Position pages are explicitly scrollable.


## Latest Management Payment Cycle layer
- Tracks payments received per contract.
- Schedules management payments using the position's month interval.
- Cycles 1 and 2 follow normal qualification.
- Cycle 3 onward checks the continuing direct-member requirement.
- Failed continuing qualification terminates the active contract and resets active qualifying-member count to 0 while preserving historical records.
- Payment scheduling is separated from final wallet settlement so financial credits can be audited/approved.


## Withdrawal schedule update
Withdrawal availability now has two layers:
1. Global Admin switch — if OFF, no rank can withdraw.
2. Rank-specific schedule — each rank has its own allowed weekdays.

Both conditions must pass before a withdrawal request can proceed. Global 24-hour, fee, identity, balance and processing rules remain in effect.


## Latest referral attribution layer
- Every user can receive a persistent unique Global Nexus Capital referral code.
- Registration can carry the referral code in the URL.
- A new account gets exactly one direct referrer.
- Self-referrals are rejected.
- Direct referral attribution is stored before any Starter qualification.
- QR payload storage is prepared for generating the user's referral QR code.


## Latest Rank layer
- Persistent rank configuration with rank-specific daily earnings and divisors.
- User Rank page is vertically scrollable.
- Rank cards are horizontally scrollable.
- Current rank information is separated from the full rank list.
- Admin Rank Management supports editing each rank's earnings and divisor.


## Rank purchase locking update
Rank purchasing now follows the requested sequential access rule:
- Before any purchase, all configured ranks are available.
- After Rank N is purchased, Rank 1 through Rank N are locked.
- Rank N+1 through the highest rank remain available.
- Only one rank may be purchased at a time and the next available rank must be purchased next.
- Lower ranks never reopen after a higher rank has been purchased.
- Rank purchases are persisted separately from the user's current rank.


## Canonical Global Nexus Capital rank names
The official rank names are now locked into the build:
1. STARTER — 3 tasks / ÷3
2. GROWTH — 5 tasks / ÷5
3. SUPER — 7 tasks / ÷7
4. ELITE — 10 tasks / ÷10
5. PREMIER — 13 tasks / ÷13
6. PREMIUM — 16 tasks / ÷16
7. LEGACY — 20 tasks / ÷20
8. ULTIMATE — 25 tasks / ÷25
9. SUPREME — 30 tasks / ÷30

These names should be used consistently across User pages, Admin pages, task assignment, rank purchases, withdrawal schedules, referrals/positions, and financial records.


## UI continuity pass
The Home and Mine screens were aligned with the supplied Global Nexus Capital reference screenshots:
- Mobile-first blue hero/header
- Mine profile and account summary
- Registration Date shown on the account/home information
- Four Mine action tiles
- Social Security Fund banner
- Scrollable service list
- Bottom navigation with Home / Task / Message / Rank / Mine
- No Electronic Contract button
- Promotional areas remain Admin-managed
- Content pages remain vertically scrollable
- Rank navigation remains horizontally scrollable
Balances are intentionally represented as data fields rather than hard-coded demo amounts; production values must come from the authenticated database.


## Latest referral commission + financial records layer
- Persistent commission rules: Direct 8%, Second Level 2%, Last Level 1%.
- Commission ledger records source transaction, beneficiary, level, percentage and amount.
- Idempotency prevents duplicate referral commission credits.
- Commission credits are posted to the beneficiary wallet and recorded as referral-bonus transactions.
- Financial Records now has the four intended categories: Revenue, Expenditure, Deposit and Withdrawal.


## Latest Events + Lucky Cards + Points Card layer
- Persistent Admin-managed events and banners.
- Lucky Card prize rules can be configured by event and canonical Global Nexus Capital rank.
- Draw requirements, prize type/amount and maximum winners are stored persistently.
- Lucky Card draw records are unique per user/rule/draw number.
- Points are stored in a separate ledger and are not automatically treated as cash.
- Admin can create point rewards with required point totals and descriptions.
- User Lucky Cards and Points Card pages remain vertically scrollable.


## Latest Deposit/Cashier layer
- Admin-managed payment networks and phone-prefix mappings.
- Admin-managed payment account/wallet pool with min/max amount ranges.
- Deposit creation automatically detects the network from the first three digits of the registered phone number.
- An available matching payment account is automatically assigned and reserved.
- User can submit “I have made payment” after completing the payment.
- Deposit verification remains an Admin action; wallet credit should occur only after successful verification.
- Deposit and Admin payment-pool pages are vertically scrollable.


## Latest financial integrity + Admin verification layer
- Added an immutable wallet ledger alongside transaction records.
- Admin deposit verification now credits the exact amount in the same database transaction as the verified order and financial record.
- Rejection does not credit the wallet and releases the assigned payment account.
- Deposit verification/rejection actions are audit logged.
- Financial Records API reads persistent wallet-ledger entries.


## Latest Withdrawal layer
- Real persistent withdrawal orders.
- Global Admin withdrawal switch plus per-canonical-rank allowed weekdays.
- Account Security approval is required before withdrawal.
- Exact 6-digit Funds Password is required.
- One withdrawal request per 24 hours.
- Admin-configured percentage/fixed service fee with calculated net amount.
- Admin-configured 0–48 hour processing window.
- Gross withdrawal amount is reserved from the wallet when submitted.
- Admin approval completes the withdrawal; rejection refunds the reserved gross amount.
- Withdrawal actions are audit logged and linked to Financial Records.


## Latest Account Security + Business Security layer
- Users submit government name and ID number for withdrawal activation.
- Admin approval is required; rejection stores a reason.
- Withdrawal policy reads the approved identity status.
- Identity review actions are audit logged.
- Business Security has an Admin-managed certificate upload area.
- User Business Security displays the Admin-provided certificate when available.


## Latest content + app-download layer
- Admin Content Management controls Privacy Policy, Promotional Brochure, App Download and Business Certificate content.
- Promotional Brochure intentionally opens as a blank content area until Admin adds a banner.
- App Download has an Admin-configured download-link/file area for the eventual installable web app.
- Privacy Policy is a scrollable document page populated from Admin content.
- Business Certificate remains Admin-managed.


## Latest Employee Office + Management Positions layer
- Admin can create Global Nexus Capital branches with name, location, description and image.
- User Employee Office uses horizontally scrollable branch cards.
- Admin configures management-position requirements, qualifying-member requirements, cash bonus and display order.
- User eligibility is calculated from actual direct referrals and Starter-qualified members.
- Management payment approval is intended to occur only after configured member requirements are met.


## Latest Fund Products layer
- Admin-configurable fund products with interest rate, term, minimum and maximum purchase amount.
- User Buy Amount is used to calculate interest and maturity amount from the product's stored rate.
- Fund purchases deduct the principal from the real wallet and create Financial Records/wallet-ledger entries.
- Each purchase stores the exact rate and term used at purchase time, protecting historical records if Admin later changes a product.
- Fund products and purchases remain separate from cash balances until their configured maturity workflow is completed.


## Latest Fund Maturity layer
- Due funds are detected from each purchase's stored maturity date.
- At maturity, the exact stored principal + interest is credited to the real wallet.
- A dedicated maturity ledger and Financial Record are created.
- Processing is idempotent: a fund purchase cannot be matured and credited twice.
- The original purchase rate, term and maturity amount remain immutable for historical accuracy.


## Latest Task Management layer
- Admin can configure task title, description, image, question, correct answer, commission, rank and display order.
- Tasks can be activated/deactivated by Admin.
- User task visibility is tied to the user's purchased/current rank.
- A user can submit a task only once.
- Correct submissions create task earnings in the real wallet ledger and Financial Records.
- Incorrect submissions do not create earnings.
- Task submission records retain the answer and result for auditing.


## Latest Rank System layer
- Canonical Global Nexus Capital ranks are fixed as: STARTER, GROWTH, SUPER, ELITE, PREMIER, PREMIUM, LEGACY, ULTIMATE, SUPREME.
- The configured division counts are preserved: 3, 5, 7, 10, 13, 16, 20, 25, 30.
- Admin can configure each rank's purchase price, daily earning, division count, color and banner.
- User rank cards scroll horizontally.
- Purchases are sequential: the next rank above the highest purchased rank is the only available purchase; purchased/lower ranks remain locked.
- Rank purchase deducts the real wallet balance and creates a Rank Purchase Financial Record.
- The user's current rank becomes the highest rank they have actually purchased.


## Latest Rank Daily Earnings layer
- Daily rank earnings use the Admin-configured daily earning divided by the rank's stored division count.
- Division counts are preserved as 3, 5, 7, 10, 13, 16, 20, 25, 25 for the nine canonical ranks.
- Each user/rank/date has a unique earning record, preventing duplicate daily credits.
- Credits go to the real wallet, wallet ledger and Financial Records.
- Admin has a daily rank-earning processing control.


## Latest Messages layer
- Admin-only publishing controls for official Global Nexus Capital messages.
- Messages support title, body, optional image, publish time and expiry time.
- User Message page shows only active, currently published messages.
- Read state is persisted per user/message.
- No social follow/like controls are added.


## Latest Team Expansion + Direct Referral layer
- Persistent direct referral links and direct-referral relationships.
- No A/B/C referral categories.
- Team counts are calculated from actual direct referral records.
- Starter-qualified count is stored separately for management-position and referral qualification logic.
- User Team Expansion page shows direct-member and Starter-qualified counts.
- Admin has a Team & Referrals oversight page.


## Latest Qualification layer
- Starter qualification is now a persistent event tied to the successful rank-purchase record.
- Direct-referral qualification status updates from the actual referred user's qualifying purchase.
- Qualification is idempotent: a user cannot receive duplicate Starter qualification events.
- Management-position and Team Expansion logic can use the same qualification record.
- Admin has a qualification audit page.


## Latest Events + Lucky Cards + Points Card layer
- Admin can create/open events with banners and schedules.
- Lucky Card prizes can be configured by rank, prize type, draw requirement and maximum draws.
- Lucky Card draws are stored individually and eligibility is enforced before a draw.
- Points are stored separately from wallet cash.
- Admin can configure Points Card rewards and point requirements.
- Points are not automatically converted to cash.
- User pages for Events, Lucky Cards and Points Card remain scrollable.


## Latest Referral Commission + Salary Cycle layer
- Referral commission settings are persisted as 8% direct, 2% second-level and 1% last-level defaults.
- Referral salary contracts use a 2-month cycle.
- First and second payments can pay normally.
- From the third payment onward, qualifying-member growth since activation is required.
- If required growth is absent at a third-or-later payment, the contract is terminated and that scheduled payment is skipped.
- Paid salary credits go to the real wallet, wallet ledger and Financial Records.
- Salary payment records are unique per contract/payment number.


## Latest Financial Records layer
- User Financial Records reads the persistent wallet ledger and linked transaction records.
- Supports transaction filtering by type/status at the API layer.
- Tracks total credits and debits from real ledger entries.
- Includes deposits, withdrawals, rank purchases, fund purchases/maturities, task earnings, rank earnings, referral salary and commission entries.
- Admin has a platform Financial Records overview.


## Latest Mine + Account Controls layer
- Mine page consolidates the User's account, wallet, security, records, referrals, positions, funds and withdrawal controls.
- Settings persist language and notification preferences.
- Support requests are persistent and have Admin reply/status workflow.
- Passwords and Funds Passwords are intentionally not displayed in Admin; secure reset/change flows are used instead.
- User pages retain the scrollable mobile-first layout and the Global Nexus Capital bottom navigation.

## Final Integration Pass
- Reconciled additive schema compatibility for legacy/current Global Nexus Capital columns.
- Expanded transaction types so all real wallet flows can be recorded without constraint failures.
- Added missing compatibility columns for rank, fund, task, identity and referral-salary flows.
- Rank purchasing now follows the requested behavior: purchased/lower ranks remain locked while higher ranks are available; purchasing a higher rank updates the current rank. Starter qualification is triggered by a successful STARTER purchase.
- Canonical rank divisions are STARTER 3, GROWTH 5, SUPER 7, ELITE 10, PREMIER 13, PREMIUM 16, LEGACY 20, ULTIMATE 25, SUPREME 30.
- Added a source-level integration validation script covering required pages, schema anchors and JavaScript structural checks.
- Static integration validation passed across 127 source files. A full Next.js production build was not completed in this environment because dependency installation timed out.
