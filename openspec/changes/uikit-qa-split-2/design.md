## Decisions

1. One test per `smoke` / `smokeS` call: fresh `page.goto('/uikit/<hash>')`; `watchErrors` (console error / warning, page error, failed request — the qa.mjs `errs` listeners) asserted empty. `scen(label)` = SCEN3 feature page + tab click, waiting for `aria-selected`. Every `waitForTimeout` becomes a web-first assertion or `expect.poll` on the value read.
2. `ok()` source checks read `uikit/src`, `uikit/scripts/shots.mjs`, `uikit/package.json` with the same regexes; version `ok`s = one test, one `expect` each. The rendered-borders route walk: one test per 10 routes.
3. 950–1000: only the DPI-badge `ok` moves. The hue / contrast walk has no `ok()` or smoke call (arrays never asserted), so it is dropped from qa.mjs without changing the counts; the PR body records it.
4. kit10 (row menu, KS8) and W3 (KS15) replay the walk opening (reset, library, book, folder, p1; W3 also the photo drag). In qa.mjs the walks keep their state-changing steps; only the reads and `ok`s go.
5. `kit-toggle-size`: its `#/demo` `beforeEach` moves into a `describe`, so the new tests do not run it.

## Touch-set & Test Plan

| Path                                  |
| ------------------------------------- |
| `uikit/scripts/qa.mjs`                |
| `e2e/kit-spread-list.spec.ts`         |
| `e2e/kit-book-settings.spec.ts`       |
| `e2e/kit-sliders.spec.ts`             |
| `e2e/kit-toggle-size.spec.ts`         |
| `e2e/kit-tokens.spec.ts`              |
| `docs/roadmap/P3/uikit-qa-split-1.md` |
| `docs/roadmap/P3/uikit-qa-split-2.md` |

- Reuse: `watchErrors` / `open` / `visit` / `settled` / `walk` shapes from kit-library and kit-tokens.
- Tests: the 5 kit specs green; `pnpm uikit:qa:quick` green, 322 → 299 `ok()`, 30 → 16 smoke.
