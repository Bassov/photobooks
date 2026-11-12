# product-walkthrough

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item product-walkthrough
Status: done

## Scope

- [ ] Kit page `#/guide` (+ `#/guide/<chapter-id>` deep link) and a "Guide" link in the KitBar: a long-read product guide with 18 chapters in five parts (Start → Make the book → Polish → Print → Share), a sticky chapter list, a hero with a journey row, and a feature index generated from `MANIFEST`. Designer Spec `shared/design/product-walkthrough/spec.md` (2026-11-12) is the SoT for all values and copy; kit only, no `src/**` changes. DEMO branch: never merges (Owner 2026-11-12).
- [ ] Chapter 16 "Print at home and bind": interactive panel (page-count Segmented, sheets in saddle-stitch folding order from a pure `saddleSheets(n)`, five assembly steps, paper / size / thickness notes).
- [ ] Screenshots `uikit/public/guide/*.jpg` from the deterministic `#/demo` walk (`scripts/guide-shots.mjs`, `capture()` gets an optional `dpr`, default 1) with numbered markers from `shots.json`; ≤ 3 MB total.
- [ ] Every quoted label, gesture and key checked against the kit source and prod; corrections listed in the PR body.
- **Browser check:** `#/guide` at 1440 × 900: 18 chapters, TOC click scrolls the chapter to y 72 and marks it current, Pages 22 shows 6 sheets without moving the assembly row; no horizontal scroll at 1280.

## Done when

- `uikit/scripts/guide-qa.mjs` passes: 18 sections + one h1, no console errors, every image loads; every `MANIFEST` slug in `CHAPTER_OF` and every `#/feature/` link resolves; `saddleSheets(20)` / `saddleSheets(22)`; the Pages switch doesn't move the assembly row; TOC link 16 → `#print-home` at y 72 ±1 and current; no horizontal scroll at 1280.
- `#/demo` walk captures stay pixel-identical (0 changed steps); uikit typecheck green; no `src/**` changes.
