## Implementation

- [x] 1. `pnpm roadmap sync`: tick the 25 P1 items already `Status: done` on main (design-r7-spreads … thumb-warm-slice) (`synced 25 index tick(s)`)
- [x] 2. Close with evidence via `pnpm roadmap done --note`: `fix-flaky-node-tests` (done, #351), `e2e-photo-fixture-race` (superseded, #348 `writeIfChanged`), `frame-styles` (superseded, #327/#336/#380 + new item); one-line why in each file (`## Done note`)
- [x] 3. `pnpm roadmap add` the P2 item that turns `FRAME_STYLE_AND_ARRANGE_VISIBLE` back on with kit M78 styling (Frame style + Arrange, kit `sections.tsx` / `inspector.tsx`), carrying the frame-styles Browser check; `arrange-lock` depends on it (`docs/roadmap/P2/framestyle-arrange-unhide.md`, P2 top)
- [x] 4. Kept items: one-line audit delta notes where part shipped (`arrange-lock`, `user-templates`, `print-profiles`, `cover-editor`); repoint the stale `page-numbers` kit path (`demo-parts/v7.tsx` → `sandbox/v7.tsx`)
- [x] 5. Index counts line matches the result (`roadmap check`: 75 items, 39 open incl. this one)
- [x] 6. PR body: `slug | decision | evidence` table for every open item, needs-Owner list, Russian Owner summary (≤15 lines) (`.cache/agent/roadmap-audit-pr-body.md`)

## Manual test scenarios

N/A (docs only, no UI).
