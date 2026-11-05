# live-captions-core

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item live-captions-core
Status: done

## Scope

- [ ] Live caption core (Designer `live-captions` spec, item 2 of 3): `resolveText` tokens `{date}` (`D Mon YYYY`, fixed English months), `{title}` / `{caption}` / `{camera}` from the anchored photo's `meta` (no book title, no caption → title fallback), empty part dropped with its `·`, `—` for an anchor frame without a photo
- [ ] Ops: `editText` keeps the content type; `setTextLive` (on: template from the text + nearest image frame by rect distance, photos first; off = Make static with the painted text) and `setTextAnchor`, one history step each; after every op an anchor that is no longer an image frame of the spread makes the caption static with the text resolved before the op
- [ ] Import: the JPEG head pass stores `meta` (title / caption / camera / lens / keywords) with `capturedAt`, `meta: {}` when the file has none; `readCamera` drops a repeated make ("Canon Canon EOS R5" → "Canon EOS R5")
- **Done when:** `textFrame.test.ts` anchored `{title}` / `{caption}` cases updated; unit + PBT for date format, part dropping and `—`; PBT: `bad-text-anchor` never fires after random user ops (incl. removeFrames, duplicateSpread, undo); `readCamera` unit test; stryker-diff not lowered on the touched files.
- **Perf:** resolution stays derived at paint (no stored resolved text); anchor normalisation skips spreads the op did not change.
- **Browser check:** none — no visible UI change (code review only); the inspector Live block ships in `live-captions`.
- **Depends:** text-blocks
- **UI kit:** partial: `uikit/src/sandbox/meta.ts` (token values; same resolution rules); the Live block UI in `uikit/src/sandbox/sections.tsx` is item `live-captions`.
