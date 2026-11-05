## Implementation

- [ ] 1. `resolveText.ts`: `{date}` / `{title}` / `{caption}` / `{camera}` from the anchored photo, part dropping, `—`; update `textFrame.test.ts` cases + new unit / PBT.
- [ ] 2. `frames.ts`: `editText` keeps the content type; `setTextLive`, `setTextAnchor`, default anchor; unit tests.
- [ ] 3. `applyBookOp.ts`: op cases + anchor normalisation after every op; `bookHistory.ts` labels; unit tests.
- [ ] 4. PBT: random user ops with undo / redo never trip `bad-text-anchor`.
- [ ] 5. `jpegHeadPass.ts` stores `meta` (`{}` when none, read once); `readCamera` dedupe; unit tests.

## Manual test scenarios

N/A — no visible UI change (code review only).
