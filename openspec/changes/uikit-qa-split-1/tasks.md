## Implementation

- [x] 1. Split map (feature → ranges → spec → count → item) in `docs/roadmap/P3/uikit-qa-split-1.md`
- [x] 2. Port qa.mjs 314–479, 481–648 to `e2e/kit-{library,editor-canvas,tokens,credits}.spec.ts` (new) and `e2e/kit-personal-site.spec.ts` (append)
- [x] 3. Remove the ported blocks from `uikit/scripts/qa.mjs` (sections 0–3 and helpers untouched; 349 → 322 `ok()`, 48 → 30 smoke)

## Manual test scenarios

N/A — test move, no UI change (the moved checks run headless in Playwright).
