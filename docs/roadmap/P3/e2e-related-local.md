# e2e-related-local

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item e2e-related-local

## Scope

- [ ] Local B also runs the existing e2e specs that a `src/` diff can break (process item P-20261115-0213-1: #579 `spread-view.spec.ts`, #591 `site-settings.spec.ts`, #608 `design-r26-icon-classes.spec.ts` failed only in CI).
  - [ ] New `scripts/e2e-related.mjs` + vitest test: reads `git diff -U3` vs `origin/main` (or `$STRYKER_DIFF_BASE`) for `src/**/*.{ts,tsx,css}`; collects test ids (`data-testid="x"`, `testId: 'x'`, `` `x-${…}` `` prefixes) from the changed hunks only (added, removed and context lines); selects e2e specs and `e2e/fixtures/*` users whose `getByTestId('x')` / `[data-testid="x"]` match; ranks by matched ids, caps at 12 (`E2E_RELATED_MAX`), prints selected and dropped lists; skips flaky specs like the rig.
  - [ ] `package.json` `test:e2e:changed:quiet`: rig changed set first, then the related set once (chromium, workers=1, dot reporter), printing `related-e2e: N passed / failed`. Local only: CI burn-in selection unchanged.
  - [ ] `docs/agent-loop.md`: the B row says B also runs the related specs; a failure is fixed in the product or the spec in the same PR, never skipped or weakened. The "skip the e2e half of B when pointless" line goes.
  - [ ] Sunset (script header): when the rig's own e2e-changed selection maps `src/` → specs, delete the script and call the rig.
- **Done when:** replaying the script on the parent..merge diff of #579, #591, #608 selects the spec that failed in CI for ≥2 of 3 (results in the PR body); median wall time of the related step over those replays ≤6 min locally with ≤12 specs; unit tests cover hunk-only id extraction, the template prefix, cap ordering and flaky skip.
- **Browser check:** N/A (agent tooling; no app change).
- **UI kit:** none (no matching component)
