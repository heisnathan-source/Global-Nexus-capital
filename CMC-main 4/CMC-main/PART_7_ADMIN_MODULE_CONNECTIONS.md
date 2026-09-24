# Global Nexus Capital Part 7 — Admin Module Connections

## Scope
This pass fixes the dead Admin-module navigation paths exposed by the dashboard. Every Admin module tile now resolves to a protected Admin page instead of a 404, and every module page provides a working route back to the Admin dashboard plus a related user-facing page.

## Important
This is a navigation/connection pass, not a claim that every module's business controls are finished. Detailed controls remain subject to their dedicated implementation passes.
