# Global Nexus Capital Fix Pack

This build fixes the navigation and user-facing interaction issues found during PC testing.

## Main fixes
- Fixed missing User-page routes for Company Activity and Member Benefits.
- Rebuilt Admin Dashboard module links so each module opens the correct Admin page.
- Admin has a protected login page with no public Admin signup; `/admin` and all Admin subroutes require an Admin session.
- Added working User link from Admin Dashboard back to the User site.
- Rank page now uses a distinct color for every rank and no longer exposes the division count to users.
- Rank purchasing is limited to the next rank only.
- Team Expansion now generates a referral QR code and provides Share/Copy actions.
- Deposit now uses a separate amount-selection flow and then opens the Payment page.
- Payment page shows the assigned payment account and makes “I have made payment” submit the order.
- Deposit verification Refresh has the required 2-minute cooldown.
- Withdrawal now asks the user to create a 6-digit numeric Funds Password the first time they open Withdrawal.
- Withdrawal amount choices are loaded from Admin-configured withdrawal amounts.
- Withdrawal service charge and amount received calculate from Admin policy when available.
- Removed the long withdrawal-availability explanation from the user page.
- Account Security form now saves government name/ID correctly and displays verification status.
- Settings “Save Settings” now calls the preferences API.
- User Login now actually calls the login API and redirects to the User home page.
- Local development login cookies no longer require HTTPS; production still uses Secure cookies.
- Fixed the identity-verification SQL schema/API mismatch.
- Fixed the Admin/User route mapping audit and verified there are no broken static href targets.

## Important
The project still requires the existing PostgreSQL configuration and environment variables from the Global Nexus Capital setup instructions. Do not put real money into the system during local testing.

The referral QR currently uses an online QR image endpoint so the local build does not need another npm dependency. It can be replaced with an internal QR generator before production launch.

## Part 9
- User login explicitly accepts only role=user accounts; Admin accounts cannot authenticate through the normal User Login route.
- Admin login remains the only entry point for Admin sessions.
- Admin dashboard and every Admin subroute remain protected by middleware.
