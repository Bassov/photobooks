# polish-icons-chrome

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item polish-icons-chrome
Status: done

Q-21 polish item 4, part 1 (Designer spec `walkthrough-polish-review`, Musts P6, P8, P9). Kit + prod in one PR.
P10 (warm neutral chrome) is a follow-up item (polish-warm-chrome); no palette change here.

## Scope

- [ ] P6 icons: Lucide stroke by size in prod `src/ui/Icon.tsx` and the kit icons: 1.75 at 16 px, 1.5 at 12–14 px, 2 at 10 px status glyphs (Low-res, used check).
- [ ] P8 one primary action: Publish = ink pill h32, padding 0 12, 13/500, bg #232223, text #F2F2F2, `--shadow-xs`; hover #3A3839; focus-visible outline 2px #3A3839 offset 2; running job bg #BFBDB9, text #F2F2F2, no shadow (progress / percent states kept). Preview, Export site, Print keep the secondary fill; Settings stays ghost. Prod and kit `#/demo`. Replaces M111 "match Preview".
- [ ] P9 quieter canvas: `--dot` alpha .55 → .30 in prod and kit.
- [ ] Tests that pin the old look updated; `#/demo` baseline images re-captured for changed steps.

## Done when

- Prod and kit Publish pill computed styles match P8 in rest, hover, focus-visible and running (e2e on `#/demo` and prod).
- Icon stroke-width at 16 / 12–14 / 10 px = 1.75 / 1.5 / 2 in prod and kit (e2e samples ≥3 icons per size class where the screen has them).
- Canvas dot colour alpha = .30 in prod and kit (computed style + one paint check on the canvas).
- PR body: Must → evidence table for P6, P8, P9.

**Browser check:** editor with photos at 1440×900: Publish is the only dark pill in the top bar; icons look thinner; canvas dots are fainter. Same in kit `#/demo`.

**Perf:** CSS / prop values only; no new handlers.

**Hard nos:** no palette change (P10); no edits in files held by open PRs #675, #677, #678, #679, #680.

**UI kit:** `uikit/src/demo-parts/editor.tsx`, kit icon usages, `uikit/src/index.css` `--dot`.
