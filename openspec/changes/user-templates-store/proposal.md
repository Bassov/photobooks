## Proposal

Roadmap: `docs/roadmap/P3/user-templates-store.md` (scope SoT); Designer spec `user-templates` UT1 guard + UT5.

### Scope out

- Picker shape filter, dedup, announcements (`user-templates-picker`); best fit (`user-templates-best-fit`).

### Delta / Risk

- `library.json` v2 holds publish statuses, so templates land in v3. No library open: templates last for the session.
- Until `user-templates-picker`, `LayoutSection` saves `pages: 2`, so a page-1 save is a no-op on single pages.
- Security: `library.json` and legacy `localStorage` are untrusted; each entry is zod-validated, invalid ones dropped; the key is removed only after a successful write.
