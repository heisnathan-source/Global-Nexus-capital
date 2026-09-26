Global Nexus Capital Part 2 — Authentication

This part adds:
- User login API/session.
- Real database-backed registration after OTP verification.
- Local-only development OTP (CMC_DEV_OTP; never use this as production SMS verification).
- Admin login at /admin/login.
- No public Admin signup.
- Middleware protection for every /admin route except /admin/login.
- Admin accounts use users.role='admin' and must be provisioned with scripts_create_admin.mjs.

Before testing:
1. Apply the updated db/schema.sql to the local cmc database.
2. Configure DATABASE_URL and CMC_SESSION_SECRET in .env.local.
3. Set CMC_ADMIN_PHONE and CMC_ADMIN_PASSWORD in .env.local.
4. Run: node scripts_create_admin.mjs
5. Run: npm run dev
6. User login: http://localhost:3000/login
7. User signup: http://localhost:3000/register
8. Admin login: http://localhost:3000/admin/login

The local OTP is shown on the registration screen only for development. A real SMS provider must replace this before production.
