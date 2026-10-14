---
name: ui-review
description: >-
  Short UI review checklist for Photobooks — a11y, anti-generic aesthetics,
  component states, density, and layout smoke. Use when reviewing or shipping
  UI in an OpenSpec design/apply, or when asked to deslop / audit a screen.
  Not a full design-system authoring pipeline. Mandatory when UI is in scope
  before push/archive (see openspec/config.yaml).
---

# UI review (short)

## Pass/fail gates

- **A11y:** visible focus, keyboard path for primary actions, labeled controls, contrast, `prefers-reduced-motion` respected for non-essential motion.
- **States:** interactive controls cover default / hover / focus / disabled / loading / error where applicable.
- **Meaning:** do not rely on color alone for errors or status.

## Layout smoke (fail if any)

Run against a real preview or Playwright — do not pass from code reading alone.

- **Empty:** empty-state copy is readable in one flow (not one word per line / crushed into a ~1px virtualizer window). Prefer e2e bounding-box assertions.
- **Happy:** the primary changed surface shows the claimed UX (e.g. aspect silhouettes, `object-fit: contain`, status strip).
- **Scroll / interact:** for lists or scrollports, mid-scroll the visible area is filled when more content still exists (no large dead zone while the scrollbar can move further). Fixed window item counts alone are not enough for variable-width/height virtualization.
- **Packing:** adjacent cards/items leave a uniform small gap from each card’s end — not leftover space from a max-width/max-height stride.

Page-level overflow containment stays a Playwright invariant (`assertDocumentFitsViewport` / `assertNamedScrollport`), not this skill’s sole gate.

## Anti-slop (fail if dominant)

- Inter/Roboto/Arial/system as the only display voice on branded surfaces.
- Purple/indigo gradient-on-white default theme with no brand rationale.
- Hero as inset card collage with floating badges/chips.
- Decorative glow, blob radius, emoji as structure.

## Photobooks product UI

- Local-first editor chrome: clarity over marketing density.
- Photo preview is the visual anchor; metadata secondary.
- Prefer one primary CTA per view ("Open photo", etc.).

## Output

When reviewing, list findings as `[severity] area — issue — fix`. Block on a11y, missing critical states, or layout-smoke failures.
