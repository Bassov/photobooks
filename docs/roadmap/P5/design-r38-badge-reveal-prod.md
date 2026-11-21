# design-r38-badge-reveal-prod

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r38-badge-reveal-prod
Status: done

## Scope

Designer parity placed-badge Must M145 (Round 38; Designer spec B4): after a placed-badge jump the target frame stays partly under the spread list (1060 px spread at 95 %: frame x 133.7–556.3, port x 212–1140, the nudge never scrolls sideways) or, at 2×, a frame taller than the 720 px port is cut 371 px at the top and sits 84 px above the bottom. Designer rule: after the reveal, per axis, if the frame fits the port inset by 24 px scroll the least that puts it inside; if it is larger, centre it on that axis.

- [ ] Unit (`pasteboardReveal.test.ts`): fits → least scroll to the 24 px inset (incl. x 133.7 → ≥ 236 at port left 212); larger than the port → centred on that axis (overflow split equally ±1 px).
- [ ] e2e (`placed-badge.spec.ts`): a jump to a frame that starts under the spread list → frame left ≥ spread-list right + 24 and `elementsFromPoint` at its left handle hits the frame, not the list; at 200 % the overflow is split equally ±2 px.
- [ ] Zoom is kept across the jump (existing placed-badge tests stay green).
- **Browser check:** 1440 × 900, 50 % zoom, book parked right of the port: a badge click shows the whole Pages 2–3 frame 24 px right of the spread list; at 200 % the frame is centred.
