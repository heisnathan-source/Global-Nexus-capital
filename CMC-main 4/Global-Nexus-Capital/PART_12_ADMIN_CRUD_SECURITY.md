# Global Nexus Capital Part 12 — Admin CRUD + Security Hardening

Implemented in this pass:
- Admin Events Save now persists to the canonical events table.
- Admin Lucky Cards Save Prize Rule now persists to lucky_card_rules and links the selected event/rank.
- Admin Employee Office Save Branch now persists to branches.
- Admin pages reload saved records after successful writes.
- The shared requireRole helper now validates the signed Global Nexus Capital session cookie instead of trusting a client-supplied role header.
- Canonical SUPREME commission divisor is aligned to 30, matching the Global Nexus Capital Master Build Specification.

Not implemented in this pass:
- Media/file uploads for banners or branch images; image URL fields are used until proper storage is added.
- Member Benefits persistence because the current schema does not contain a canonical benefits table.

Validation:
- JS syntax checks are performed on changed API files and server helper.
- Full Next.js/PostgreSQL runtime validation still requires the PC environment and configured database.
