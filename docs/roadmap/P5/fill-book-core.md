# fill-book-core

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item fill-book-core
Status: done

Core part of the Designer feature "fill book" (Owner Q-26, item 1 of 3, Must FB2; design spec `fill-book/spec.md` "### Core"). One book op places the unplaced photos, in the caller's order, into the empty frames before the last page, then onto new spreads of 2 photos inserted before the last page, then into the last page's empty frames, without passing the page limit. Core only, no UI.

## Scope

- [ ] `src/core/ops/fill.ts`: `FillBookPlan`, `planFillBook(book, assetIds, maxPages)` and `fillBook(book, assetIds, saved, maxPages)`. Order E (empty own photo frames of spreads 0 … n−2, reading order) → new spreads in chunks of 2 at index `max(1, n−1)+k` → L (last page's empty frames); leftover = the tail. A shared helper is factored out of `insertSpreadWithAssets`; no nested ops. Cover, endpapers and master items stay `===`.
- [ ] `src/core/ops/applyBookOp.ts`: op `{ type: 'fillBook', assetIds, templates, maxPages }`; `src/core/index.ts` exports both functions and the type.
- [ ] `src/core/ops/fill.test.ts`: every unit case of the design spec "## Tests"; `src/core/ops/fillBook.pbt.test.ts`: the PBT (plan numbers = what `fillBook` does; every placed photo was unplaced before).
- [ ] OpenSpec: the fill-book requirement lands in a core book-ops capability spec (not `editor-shell`).
- **Browser check:** none (core only; kit FB1 and prod FB3 are later items; the history label belongs to FB3).

## Done when

- [ ] All design-spec unit cases pass; the PBT over random books and photo counts is green (placed count, spread count and page count match the plan).
- [ ] `fillBook` on a 3-spread book + 12 unplaced photos gives spreads labelled 1, 2–3, … 12 pages with the 12th photo on the last page; pagesAfter ≤ maxPages always.
- [ ] stryker-diff on fill.ts: no NoCoverage, no survivors left without a reason in the PR body.
- [ ] `pnpm roadmap check` green; PR body maps Must FB2 → evidence.
