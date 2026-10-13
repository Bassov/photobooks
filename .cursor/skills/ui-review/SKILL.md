---
name: ui-review
description: >-
  Short UI review checklist for Photobooks — a11y, anti-generic aesthetics,
  component states, density. Use when reviewing or shipping UI in an OpenSpec
  design/apply, or when asked to deslop / audit a screen. Not a full design-system authoring pipeline.
---

# UI review (short)

## Pass/fail gates

- **A11y:** visible focus, keyboard path for primary actions, labeled controls, contrast, `prefers-reduced-motion` respected for non-essential motion.
- **States:** interactive controls cover default / hover / focus / disabled / loading / error where applicable.
- **Meaning:** do not rely on color alone for errors or status.

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

When reviewing, list findings as `[severity] area — issue — fix`. Block on a11y or missing critical states.
