## Proposal

Roadmap: `docs/roadmap/P1/design-r2-layout-picker.md` (SoT). UI ref: `uikit#/demo` 14 / 23.

### Scope out

- My templates (`+` ships disabled) and Master & spacing / Background / Grid parity: open gaps vs `#/demo`, raised to the Owner in the PR (no item without Owner approval).
- `bestTemplateId` candidates unchanged.

### Delta / Risk

- Catalog +6 layouts; `2-up` / `4-grid` stay valid ids but leave the picker; e2e that applied them move to kit layouts.
- Plus M25 clean Preview, M2 header row. e2e: empty My templates, kit order, Full bleed clip, hover, Preview.
