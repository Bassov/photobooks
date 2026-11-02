# design-r13-polish

Tag: feature
Milestone: P1
Title: Bug: design-r13-polish: book menu position and Caption section height match the kit
Status: done

## Scope

- [x] M80: an open menu trigger carries no pressed scale (kit `transform: none`): the library "Book actions" trigger stays 28 × 28 at y 444 while its menu is open, the book menu top is 476 (gap 4.00), "Open" text y 488; the same holds for every `pb-button` menu trigger (spread-list page actions, top-bar Zoom). Border `1px transparent` and the sort menu (176 wide at x 1198, y 50) stay.
- [x] M81: Photo inspector Caption section (expanded) is the kit height: the hint is a `div`, margin `6px 0 0`, line-height 16.8; the Position & size header sits 121.8 below the CAPTION header. M76 offsets (input 28.25, hint 66.25, field radius 8 + shadow) and M72 collapsed summaries stay.
- **Done when:** `e2e/design-r13-polish.spec.ts` green with `--repeat-each=30`; M26 / M49 / M51 / M56 / M73–M77 / M79 / M80 specs, full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900, library with "Lake trip": open the book menu (trigger 28 × 28, `transform: none`, menu y 476); editor, place a photo, select the frame, expand Caption (Position & size header dy 121.8). Values within 0.5 px of `uikit#/demo` steps `library-book-menu`, `editor-frame-selected`.
- **UI kit:** `uikit/src/components/ui/button.tsx` (no press scale), `uikit/src/sandbox/inspector.tsx` (`CaptionSection` :285). UI ref: `uikit#/demo`.
- **Source:** Owner Must relayed by the Designer, round 13 (Designer review r12 of prod, 2026-11-02). Owner rule: every Designer item is a Must; round 13, Designer review r12 2026-11-02.
