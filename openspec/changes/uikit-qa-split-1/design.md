## Decisions

1. Count unit = `ok()` call sites + `smoke()` / `smokeS()` calls; the helpers and their 2 `ok()` sites stay in qa.mjs until split-5 moves the last smoke call.
2. A smoke port asserts the same selectors / clicks / waits plus `errs == []` (console error/warning, pageerror, requestfailed), collected from page load — no weaker than qa.mjs.
3. Conditionals required by the original checks live in top-level helpers (`playwright/no-conditional-in-test`); `page.evaluate` bodies are copied verbatim.
4. Checks whose result was never asserted (credits caption `bad`, `fitAir`, `fr`) are dropped; the v6.1 rendered surface scan runs the full page set (qa quick sampled 12).
5. `walk6` stays in qa.mjs (still used by a later block).

## Touch-set & Test Plan

| Path                                  | Why                                   |
| ------------------------------------- | ------------------------------------- |
| `uikit/scripts/qa.mjs`                | drop 314–479, 481–648; freeze comment |
| `e2e/kit-library.spec.ts`             | new: 10 smoke ports                   |
| `e2e/kit-editor-canvas.spec.ts`       | new: 1 `ok` + 6 smoke                 |
| `e2e/kit-tokens.spec.ts`              | new: 21 `ok`                          |
| `e2e/kit-credits.spec.ts`             | new: 5 `ok`                           |
| `e2e/kit-personal-site.spec.ts`       | append 2 smoke ports                  |
| `docs/roadmap/P3/uikit-qa-split-1.md` | split map                             |

- Reuse: `e2e/fixtures/coverage` `test` / `expect`; kit served at `/uikit/` by the existing webServer.
- Tests: the 5 kit specs green locally; `uikit:qa:quick` green.
