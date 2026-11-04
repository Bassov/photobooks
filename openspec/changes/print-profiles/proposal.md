## Proposal

Roadmap: `docs/roadmap/P4/print-profiles.md` (scope / Done when SoT).

### Scope out

- Spine width computation from the formula / table, page-count and file-limit validation, crop marks and output in export: later Print items read the profile.
- Book-side overrides stay trim / bleed only (`src/core/schema.ts` is out of this lane).
- No UI.

### Delta / Risk

- `lowDpi` takes thresholds; every caller passes the book's effective profile (`generic` keeps 200 / 150, unknown id → defaults), so badges do not change today.
