## Decisions

1. Pages: every slug in `uikit/src/kit/pages.json`, read through `fs` (the `e2e/kit-tokens.spec.ts` pattern), each as `#/feature/<slug>` at 1440×900.
2. Rules kept verbatim from the old list: no `photo-credit` and no "Photo: " / "Sources" text inside `[data-testid=demo]` (in-screen `screen-credit` removed first); each chrome caption matches `^Photo: [^·]+ · (CC BY-SA 4.0|Public domain) · modified$`, author href is a Commons `File:` page, licence href is the BY-SA 4.0 deed or a `Public_domain` page, 11px, `rgb(83, 81, 82)`, outside the demo.
3. "No chrome captions" becomes an exact set match. The test finds the hi/ ids the demo paints by itself: computed `background-image`, `img.currentSrc`, SVG `<image href>`, not the `DemoCredits` attribute scan. The chrome caption ids (`data-photo`) must equal that set. A page with only CC0 photos then owes no caption, and a hi/ photo with no caption fails.
4. Paint: each caption is scrolled into view, and `elementFromPoint` at its first glyphs must land inside it.
5. Non-vacuity: one test asserts that `open-save-project` and `spread-templates-ui` (both show hi/ photos) render a visible chrome caption. The kit captions hi/ photos only (`uikit/src/kit/Credits.tsx`); recents-home's demo shows CC0 covers.

## Touch-set & Test Plan

| File                                       | Why                         |
| ------------------------------------------ | --------------------------- |
| `e2e/kit-chrome-captions.spec.ts`          | new spec: the asserted list |
| `docs/roadmap/P3/recents-home-captions.md` | item scope from the brief   |

- Reuse: `e2e/fixtures/coverage` test/expect; `expect.poll` waits for the `DemoCredits` MutationObserver.
- Tests: e2e only (23 tests); no unit, no PBT (no `src/` change).
