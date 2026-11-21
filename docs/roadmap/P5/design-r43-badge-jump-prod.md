# design-r43-badge-jump-prod

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item design-r43-badge-jump-prod

## Scope

- [ ] Designer parity M145 carry-over (Round 43, placed-badge p2): a placed-badge jump (badge click, Enter, double-click) scrolls the pasteboard on each axis at most once, straight to the r1 per-axis result (frame fits the port inset 24 → least scroll; larger → centred on that axis; least 0 → no scroll). No spread reveal first and frame nudge after (no 228 / 668 px back-jumps). Re-click on a frame already inside the inset port at 200 % changes neither scrollLeft nor scrollTop and the frame stays. End states unchanged: 1060 wide frame left ≥ port left + 24; 200 % frame centred on y (±0.5). Other spread reveals (spread list clicks, add spread, frame reveal) unchanged.
- **Browser check:** `e2e/placed-badge.spec.ts` samples scrollLeft / scrollTop every animation frame around a fresh jump, a re-click and a cycle to page 4 at 200 % and a fresh jump at 1060 wide: each axis changes at most once; the 200 % re-click changes 0 px; existing M145 tests stay green.
