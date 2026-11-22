# design-r45-badge-jump-fit-prod

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r45-badge-jump-fit-prod
Status: done

## Scope

Design Round 45, Must M145 (carry-over): the placed-badge jump ends in the wrong place at Fit. #708 skipped the
spread reveal whenever the frame was mounted and nudged the frame the minimum from the current camera, so a target
spread at Fit stopped at the port edge (Designer spec B4: "spread reveal, then the frame rect nudged"). Kit is the
reference (`uikit/src/sandbox/store.tsx` `jumpTo`: the active spread is centred, then `revealDelta` per axis).

- [ ] `src/editor/pasteboardReveal.ts` frame-targeted reveal: a frame already inside the port inset by 24 px scrolls
      nothing; otherwise the target spread is centred per axis (clamped), the frame is placed where it sits there,
      the B4 inset rule (fits: least shift, larger: centre) is applied to that rect, and scrollLeft / scrollTop are
      written once each.
- [ ] Unit tests in `src/editor/pasteboardReveal.test.ts` (Fit centring, spread taller than the port, nudge from the
      centred spread, in-view frame writes nothing, one write per axis).
- [ ] `e2e/placed-badge.spec.ts`: Fit test (Page 1 → Pages 2–3: equal space above / below ±0.5, each axis moves at
      most once, bottom edge painted in the port, re-click scrolls 0); #708's trace and 200 % re-click tests kept.
- **Done when** (1440×900): Fit, Page 1 → Pages 2–3 and row 6 → Pages 2–3 give equal spread gaps (±0.5, ≈59.2 in
  the 720 px port); at the 1060 zoom the frame is centred in the port like the kit's; the 2× end state is unchanged
  (x ≈235.9, y centred); re-click / Enter on an in-view frame scrolls 0 at Fit and 2×; each axis moves at most once.
- **Browser check:** `e2e/placed-badge.spec.ts` (Chromium, 1440×900) + Designer p3 parity scripts on a local build.
