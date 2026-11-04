# default-master

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item default-master

## Scope

- [x] Core: `ensureDefaultParent(book)` gives every book an empty default master ("Master A" on a fresh book); new books and books opened from the library get it; `removeParent` on the default and `setDefaultParent(null)` with parents leave the book
- [x] Masters panel: intro note naming the default, "Default" tag on its row, row menu "Make default" on other masters, Delete disabled on the default
- [x] Master inspector: default head "Default · all N pages" / "Default · U of N pages" / "Default · no pages"; other masters keep "Used by …", get the unused hint and a "Make default" button
- [x] Spread inspector Master & spacing: always a native select (masters in book order + None, the default's option `{name} · default`, full width 268), status line "Book default" / "Instead of {default}" / "No master on this spread", "Edit master" opens Masters on it
- [x] Kit (`uikit/src/sandbox`): the same select, Default tag, intro note, row menu, master head and Make default; `sp.master` undefined follows the kit default
- [x] Tests: unit (no parents → default; parents without default; default kept; default not deletable; Make default) and e2e on a fresh book (select + "Book default"; New master B → Make default → spreads follow B, B tagged; None on one spread → "No master on this spread", head "Default · 4 of 6 pages"; Edit master); DOM measurements select width 268, status line 16.8 px
- **Done when:** typecheck + unit + kit qa green; e2e above green; full e2e at the end; PR body lists Spec items, quotes the Owner amendment (select always) and any deviation
- **Perf:** N/A — one select, one status line, one tag per row
- **Browser check:** new book → spread 2–3 → inspector select `Master A · default`, status "Book default"; Masters → New master → Make default → spreads follow Master B, B tagged Default
- **Hard nos:** no segmented Master control; off limits `uikit/src/sandbox/viewport.tsx`, the ThumbGrid component in `uikit/src/sandbox/chrome.tsx`, presentation overlay files, Arrange/rulers files, `uikit/src/features/site-*`, `library.tsx`; do not regress master-spread-both-pages
- **Source:** Owner product decision Q-9 2026-11-04; Designer Spec `photobooks-orch/shared/design/default-master/spec.md`; Owner amendment (2026-11-04): a dropdown from the start, so the UI does not change with the number of masters
