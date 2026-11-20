# polish-type

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item polish-type
Status: done

## Scope

Designer Spec walkthrough-polish-review (2026-11-20), item 2: P2 "One type scale" and P3 "Two trackings" (Owner Q-21 2026-11-20: all six polish items in order). Kit + prod in one PR.

- [ ] P3 panel caps 11/600 0.12em `#535152`: kit `.eyebrow` and prod `.inspector-eyebrow` / specimen h2 0.06em → 0.12em (Photo, Layout, Spread Disclosure titles); one `--tracking-caps` token
- [ ] P3 display caps 11/500 0.20em: welcome (0.22em), library "Your library is ready" (0.22em), Example caption (0.18em), book object subtitle (0.3em) → 0.20em, kit and prod; one `--tracking-display` token
- [ ] P2 Lora at 400 in app chrome: `--heading-weight` 500 → 400 (Settings h1, dialog titles), empty-state title 500 → 400, editor brand 700 → 400; no font-weight 700 in app chrome
- [ ] P2 type scale tokens in `uikit/src/index.css` and `styles/tokens.css` (11/14 600 caps · 11/16 meta · 12/16 · 13/20 body · 13/20 500 label · Lora 18/24 · Lora 26/32 · Lora 34/40), used by the caps this item edits; remaining off-scale styles listed in the PR body
- [ ] Tests that pin the old look updated to the Spec values (design-r9-letter-spacing, design-r2-layout-picker, BookObject unit); welcome / library caps tracking and Settings h1 weight asserted in prod and kit e2e
- **Browser check:** 1440 × 900 prod and kit `#/demo`: Photo / Layout / Cover / Book panel titles letter-spacing 1.32 px (0.12em at 11 px); welcome and library caps 2.2 px (0.20em at 11 px); Settings h1 font-weight 400
- **Done when:** the e2e above pass; `git grep` finds no 0.06 / 0.18 / 0.22 / 0.3em uppercase tracking in src/ and uikit/src (site / print internals outside the Spec listed in the PR body); no colour, radius, shadow, icon or layout change (polish items 3–6)
- **Hard nos:** no edits to uikit/src/sandbox/{canvas,model,viewport,chrome,store}, uikit/src/demo-parts/editor.tsx, uikit/scripts/{demo-capture,qa}.mjs, uikit/src/features/site*, src/render/CoverView._, src/site/_, src/core/*, the kit-filmstrip / direct-crop / book-settings / editor-canvas / frame-style / layout-picker kit e2e; no line-height sweep
- **UI kit:** `uikit#/demo` welcome, library, editor inspector (Designer Spec `walkthrough-polish-review/spec.md` P2, P3)
