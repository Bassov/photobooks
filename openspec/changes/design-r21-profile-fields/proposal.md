## Proposal

Roadmap: `docs/roadmap/P4/design-r21-profile-fields.md` (scope / Done when / Browser). UI ref: `uikit#/full/site-settings` (Print presets, profile editor).

### Scope out

- `PrintPresetsSection.tsx`, `AlertDialog`, `Badge.css` (lane design-r21-presets-actions, #552) and `e2e/printer-presets.spec.ts`.
- `uikit/`: the kit is the reference.

### Delta / Risk

- Class-only fixes; no spec delta. e2e locks in the rest row (panel pixel), hover (`#D7D7D7` pixel) and the 13 profile number inputs (ui-monospace 13 px); no scrollport change.
