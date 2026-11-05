# live-captions-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item live-captions-kit
Status: done

## Scope

- [ ] Kit TextSection Live block (`uikit/src/sandbox/sections.tsx`, Designer `live-captions` Spec 2026-11-05 §Behaviour / §Visual spec / §Kit changes): switch "Live from photo metadata" (role=switch, testid `live-caption-switch`; disabled at opacity .5 + hint `live-caption-hint` only when the spread has no image frame); switch on sets the default anchor (nearest image frame with a photo, else nearest empty one); switch off = "Make caption static" (text frozen as painted, anchor dropped); "Anchored to" select only while Live, options `Frame N · <file>` / `Frame N · empty`; chips date, title, caption, camera (no `{filename}`), `title` attr = value / "Not in this photo" / "No photo in this frame"; chip click turns Live on and inserts at the remembered caret, else appends with `·`; chips on one row (h24, padding 0 4, icon gap 2, r8).
- [ ] Kit `fillTokens` (`uikit/src/sandbox/meta.ts`): caption without title fallback; empty values drop their `·` part; `—` only when the anchor frame has no photo.
- [ ] Kit canvas text edit keeps Live (`uikit/src/sandbox/canvas.tsx`, no auto switch-off).
- [ ] Kit frame delete (inspector Delete button, Del key) through one `store.tsx` helper: text frames anchored to a removed frame become static with their resolved text in the same step.
- [ ] Demo walk step `editor-text-live` right after `editor-text-overflow` (`uikit/scripts/demo-capture.mjs`: Caption style, chips date + camera); later baseline PNGs renumber.
- [ ] Regression: Playwright e2e on `/uikit/#/demo` — chips date + camera → canvas text has the photo's date and camera, no `—`, no `{`; 4 chips share one top y; switch off keeps the painted text, undo restores the template; Del on the anchor frame → caption static, text unchanged.
- **Browser check:** `#/demo` editor, draw a text frame under a photo, chips date + camera → canvas shows `… · 9 Jul 2025 · <camera>`; Live off → same text; delete the photo frame → text stays.
- **Hard nos:** no edits to `src/` (prod lane is `live-captions-core`); kit only; Designer review on the PR (hold).
- **Test:** Playwright e2e on the kit demo (DOM text, chip rects, inspector-relative y within 1 px of the Spec).
