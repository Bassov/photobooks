## Implementation

- [x] 1. Derive filmstrip `windowStart` from live `scrollLeft` + current stride prefix (scrollEpoch on scroll/jump) — `Filmstrip.tsx`
- [x] 2. Unit: mid-scroll then refine aspects / grow gallery without scroll → `data-window-count` covers scrollport — `Filmstrip.test.tsx` IMP-11/FS-03 case
- [x] 3. E2e: bulk import while scrolled; after settle without nudge, mounted window overlaps the visible scrollport — `e2e/filmstrip.spec.ts`

## Manual test scenarios

1. Import ~200 mixed-aspect photos; scroll the filmstrip during import; when import finishes, stop scrolling — strip must stay filled (no ~55% blank requiring a 5px wheel nudge).
2. Empty gallery still shows full-width empty copy; long gallery scrolls only inside `filmstrip-scroll`.
