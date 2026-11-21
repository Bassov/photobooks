# design-r33-filmstrip-prod

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r33-filmstrip-prod

## Scope

Round 33 Musts M129, M130 (Designer parity walkthrough-ux-review p2, `c2-{kit,prod}-film92`). Kit is the reference; CSS only.

- [x] M129: the filmstrip row starts 4 px into the strip (kit `p-1`): first thumb x = 224 at 1440×900, not 220, at every height; §B auto heights (76 / 91 / 122) unchanged; empty-state text stays put.
- [x] M130: thumb radius 6 → 4 px (kit `rounded-xs`); the `0 0 0 1px rgb(0 0 0 / .08)` hairline is an outer box-shadow on the thumb (kit `shadow-hairline`), not an inset overlay; focused / selected / placed looks unchanged.
- **Done when:** first thumb left x = 224 (±0.25) at 1440×900 at H 76 and 128; thumb computed radius 4px and box-shadow `rgba(0, 0, 0, 0.08) 0px 0px 0px 1px` (not inset); the ring paints 1 px outside the left and top edges (pixel probe) — pinned in `e2e/filmstrip-resize.spec.ts`.
- **Browser check:** editor with photos at 1440×900: the first thumb has a 4 px gap from the strip's left edge, 4 px corners and a faint ring just outside each thumb; drag the dock separator to 128: same.
- **UI kit:** `uikit/src/sandbox/chrome.tsx` filmstrip (`p-1 pb-2`, ThumbItem `rounded-xs shadow-hairline`).
