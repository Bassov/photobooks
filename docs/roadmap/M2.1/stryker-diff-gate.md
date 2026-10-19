# stryker-diff-gate

Tag: prep
Milestone: M2.1
Title: honest mutation on the diff: break 85, zero NoCoverage (issue #72 B, J)
Status: done

## Scope

- [x] Diff thresholds `{ high: 90, low: 85, break: 85 }` in `quality/gates.json` (owner decision: stays 85, never lowered), used by a `stryker.diff.config.mjs` that spreads the nightly config. The nightly run keeps break 60. The ratchet also requires diff ≥ nightly
- [x] After the run, `stryker-diff.mjs` fails on any `NoCoverage` mutant in changed files. `scripts/stryker-pr-summary.mjs` lists them (file:line, mutator) and lists changed files that were not mutated
- [x] Changed-but-excluded: the current product excludes (`projectSession.ts`, `usePasteboardCamera.ts`, `EditorShell.tsx`, `HomeScreen.tsx`, `App.tsx`, `previewAspect.ts`, `upgradeSessionAssets.ts`, `idb.ts`, `locks.ts`, `hash.worker.ts`, `photo.worker.ts`) become `mutation.temporaryExcludes` in `quality/gates.json` with the item that removes each one; the list can only shrink. A diff that changes an excluded file not on that list, or a skipped run while a production file changed, fails with no override. `exclusions-registry` later moves the list into the registry
- [x] Drop `--allowEmpty` when production files changed. Update the `ci-gates` scenario "Empty mutate set"
- **Done when:** PR #71's numbers (85.4% with 18 NoCoverage) and PR #82's first round (72.49%, 3 NoCoverage) would fail `stryker-diff`, a PR like #70 (only excluded files changed, not on the temporary list) fails, and a docs-only PR still passes as skipped.
- **Size:** ~700 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 B, J; PR #82

## Done note

diff thresholds 90/85/85, NoCoverage fail, temporaryExcludes shrink-only, allowEmpty dropped when production changed; fixture Done-when proven
