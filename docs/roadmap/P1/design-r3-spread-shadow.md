# design-r3-spread-shadow

Tag: feature
Milestone: P1
Title: Bug: design-r3-spread-shadow: soft constant-px spread shadow (M35) + 72/588 stack gap (M36)
Status: done

## Scope

- [ ] M35: the page shadow is the kit `--page-shadow` in screen px at 18 %, Fit, 138 % and mid zoom gesture, on an unscaled layer outside the zoom transform that tracks each page (±1 px) through a Ctrl+wheel zoom; no hard band down the gap.
- [ ] M36: stack gap 72 / 588 of the spread height at every zoom (deviation from the kit 44 / 588).
- [ ] M37: page numbers a constant 8 screen px under their page, 11 px, centred, no drift while zooming; hide threshold re-derived (8 + 11 px).
- **Browser check:** session book at 1440 × 900: Fit, zoom to ≤ 19 % and ≥ 138 %, Ctrl+wheel zoom; DOM e2e `design-r3-spread-shadow.spec.ts`.
