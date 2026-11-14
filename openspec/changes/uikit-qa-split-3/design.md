## Decisions

1. One Playwright `test()` per qa.mjs block (a `smoke` / `smokeS` call or an `ok()` group sharing setup); assertion values and selectors copied verbatim. Smoke ports collect console error / warning, page error and failed request like the qa.mjs helpers and assert none.
2. `waitForTimeout` becomes `expect` / `expect.poll` on the asserted value or on the DOM state the next step needs.
3. kit10 sub-ranges (KS1 top bar → editor chrome; master guides + page-numbers-kit → masters) replay the kit10 opening and the state-changing steps before them (photo drag, rulers + spread guide, Duplicate). W4's KS11 + "no console errors" replay the whole W4 action sequence. In qa.mjs the walks keep their state-changing steps; only reads and `ok()` go.
4. P2-10 over http: load the three routes from the Playwright webServer (`/uikit/…`) in a fresh page; assert no ≥400 response, failed request or console error.
5. Panel-visibility checks (P0-1, P2-2, Space held) start from a fresh page load, so panels are visible; the spec asserts that start state explicitly.

## Touch-set & Test Plan

| File                                  |
| ------------------------------------- |
| `uikit/scripts/qa.mjs`                |
| `e2e/kit-editor-chrome.spec.ts`       |
| `e2e/kit-credits.spec.ts`             |
| `e2e/kit-library.spec.ts`             |
| `e2e/kit-settings.spec.ts`            |
| `e2e/kit-masters.spec.ts`             |
| `docs/roadmap/P3/uikit-qa-split-1.md` |
| `docs/roadmap/P3/uikit-qa-split-3.md` |

- Reuse: per-spec helpers as in split-2 (`watchErrors`, `open`, `openKit10`, `scen`).
- Tests: the 5 specs above green locally; `pnpm uikit:qa:quick` green.
