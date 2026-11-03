# design-r16-kit-inspector

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item design-r16-kit-inspector
Status: done

## Scope

- [ ] M86: the kit Layout "Save as template" button icon is 14 × 14 like prod (`<Icon name="plus" size={14} />`), so its label starts at x 1247.06 (was 1252.06 with the 24 px icon) at 1440 × 900.
- [ ] M87: the kit All / My templates segment puts one space between label and count like prod (`My templates <span>N</span>`, ≈3.45 px), not the Tab flex gap plus `ml-1` (9.99 px); the "My templates" label starts at x 1308.56 ±0.5 (was 1305.41).
- [ ] M88: label text in the ported kit pills sits at prod's line-height: Layout "Photos" filter pills (prod `.layout-chip`, line-height normal) text y 76.75 at pill top 72.25 (was 75.84); filmstrip "Added order" / "Add folder…" chips (prod raw `.film-chip` buttons, line-height normal) 780.5 at chip top 774 (was 779.59); "Unplaced" (prod ToggleButton, line-height 1) 780.0 (was 779.59); empty filmstrip "No photos yet…" (prod `.pb-empty-title` 18 px / 1.3 around a 13 px / 1.35 span) 829.3 (was 827.58).
- **Done when:** kit qa (`uikit/scripts/qa.mjs`) asserts the M86–M88 numbers on `#/demo` at 1440 × 900 (icon 14 × 14; label x / text y within ±0.5 of prod); existing kit qa, `pnpm uikit:typecheck` and `pnpm uikit:build` green; the PR body lists M86–M88 with before/after numbers.
- **Browser check:** `uikit#/demo` at 1440 × 900: a new blank book shows the empty-strip copy at y 829.3 and the Layout chips' text 4.5 below the pill top; after Add folder the filmstrip chips' text is 6.5 below the chip top (Unplaced 6.0); the Layout section's Save as template has a 14 px plus icon and "My templates" at x 1308.56.
- **UI kit:** `uikit/src/sandbox/context-inspector.tsx` (segment :205, chips :212, Save :222), `uikit/src/sandbox/chrome.tsx` (film chips :481, empty strip :449), `uikit/src/demo-parts/editor.tsx` (Add folder… :75). UI ref: `uikit#/demo`. Prod (`src/`) is the reference and stays unchanged.
- **Source:** Designer parity r15, 2026-11-03, M86–M88 (kit only). Owner rule: every Designer item is a Must; round 16.
