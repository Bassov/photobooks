# text-frames-kit

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item text-frames-kit
Status: done

## Scope

- [ ] Kit canvas text frames (Designer text-frames Spec "Kit changes", item 1): whole-line clip (visible h = `floor(h / line) × line`), edit look (transparent, 1 px outline, no handles, `Type text` placeholder), grow on content edit up to the paper bottom, the amber `Overflow` chip (Low-res chip look, M85; 4 px below the frame, right-aligned; inside when it would pass the paper bottom)
- [ ] Kit Text tool: a click creates a 60 × 14 mm frame clamped to the page's 6 mm safe area; a drag keeps min 10 × 4.5 mm; a press over an image frame starts a text frame, over a text frame edits it; empty content `""` (no "New text"), editing starts at once; an empty new frame is removed on edit end (no history step); create + first edit = one step "Add text"
- [ ] Kit inspector: meta `Text overflows the frame` rgb(132,85,16) while overflowing; TEXT textarea grows to 160 px then scrolls, focus ring `inset 0 0 0 1px #535152`; the Live block stays
- [ ] `demo-capture.mjs`: steps `editor-text-editing` and `editor-text-overflow` after `editor-after-site`; later baselines renumber
- **Done when:** kit `#/demo` 1440 × 900: Text click → 1 frame in edit mode; Title in a 36 px box shows only whole lines (DOM: visible height a multiple of the line height, no glyph cut); Title restyle with long text shows `text-overflow-chip` 4 px below, right edge aligned; an empty new frame is removed on Esc
- **Browser check:** `uikit#/demo` editor: spread 2–3, press T, click the paper → a text frame with a caret, type, Esc; Style Title → whole lines + Overflow chip + inspector meta
- **Test:** kit `uikit/scripts/qa.mjs` text-frames block (click create + safe-area clamp, whole lines, chip position, empty removal, inspector meta, textarea max height + focus ring); demo baselines for the two new steps
- **Perf:** typing does not re-render the doc (uncontrolled textarea, grow by DOM style, commit on exit)
- **Hard nos:** kit only, no prod files; not `chrome.tsx` ThumbGrid, `viewport.tsx`, presentation, Arrange/rulers, masters files, `uikit/src/features/site-*`
- **UI kit:** `uikit/src/sandbox/canvas.tsx`, `context-inspector.tsx`, `sections.tsx`, `uikit/scripts/demo-capture.mjs`; `UI ref: uikit#/demo`; Designer spec `photobooks-orch/shared/design/text-frames/spec.md`
