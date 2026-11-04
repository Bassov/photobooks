## Proposal

Roadmap: `docs/roadmap/P4/print-model-schema.md` (scope / Done when SoT).

### Scope out

- Profile catalogue, spine formula, page-count / DPI rules (`print-profiles`); any UI or e2e.
- `src/editor/bookStore.ts` (live lane): its session book omits the new optional fields and reads as the default profile.

### Delta / Risk

- Schema v11: optional `printProfile {id, overrides}` and `cover.print.spineWidthSource`; v10 → v11 writes the defaults and changes nothing else. Optional (not required) so off-lane `Book` literals stay valid; absent reads as the default.
- Profiles only report trim / bleed issues; nothing clamps or deletes user values.
