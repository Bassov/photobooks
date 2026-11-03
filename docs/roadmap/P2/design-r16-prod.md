# design-r16-prod

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item design-r16-prod
Status: done

## Scope

- [ ] M83: the top-bar title and its size line form ONE `e7-title` button (32 tall, radius 8, `aria-label="Book settings"`); while Book settings is open it has bg rgb(215, 215, 215) and `aria-pressed="true"` (`false` otherwise). `book-title` / `book-size` test ids stay. At 1024–1233 px window width the title block stays on one line inside the 48 px bar: the size text, then the title, truncate with `…`.
- [ ] M84: the Layout section "Contact sheet" button sits at the right edge of its row (kit x 1313, right edge 1424 at 1440 × 900).
- [ ] M85: filmstrip thumbnails of low-res photos show the kit "Low-res" chip at the thumbnail's top-left (left / top 4, 11/500 rgb(132, 85, 16), bg field, radius xs, 10 px warning icon). Low-res = the canvas low-res badge threshold (`lowDpi(frameDpi(…))`, below 200 dpi) for the photo filling one page of the current book; it follows book size changes and reads stored pixel dimensions only (no decode).
- **Done when:** `e2e/design-r16-prod.spec.ts` green with `--repeat-each=30`; unit tests pin the low-res boundary; existing design specs, full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900 (plus 1024 and 1233 wide for the title bar): open Book settings from the title (one filled 32 px button, `aria-pressed=true`); select a spread (Contact sheet at x 1313–1424); add a small photo (Low-res chip at the thumb's top-left) and a 24 MP photo (no chip). Values within 0.5 px of `uikit#/demo` steps `editor-inspector-book`, `editor-spread-1`, `editor-photos-added`.
- **UI kit:** `uikit/src/sandbox/chrome.tsx` (title button :170, filmstrip chip :462), `uikit/src/sandbox/context-inspector.tsx` (Contact sheet :228). UI ref: `uikit#/demo`.
- **Source:** Designer parity r15 (kit-sync), 2026-11-03, M83–M85. Owner rule: every Designer item is a Must; round 16, Designer parity r15 2026-11-03.
