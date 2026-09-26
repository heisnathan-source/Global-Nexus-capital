# Global Nexus Capital Part 9 — Security and Navigation Boundary

- `/admin/login` is the only public Admin entry page.
- There is no public Admin registration route.
- `/admin` and `/admin/*` require a session with role=admin.
- Normal User Login only accepts role=user accounts.
- Admin cannot accidentally obtain a user session through the normal login form.
- Admin Dashboard has a direct User-site link and logout action.
