# Proposal

## Why

PR #126 (`scripts-in-scope`) landed `scripts/**/*.mjs` / `scripts/` and HEAD helpers for glob subsumption + paired thin-CLI excludes, but `pull_request_target` pr-policy still ran main’s pre-#126 ratchet and reported 38 false positives. The owner merged #126 as a one-time exception. Any other red pr-policy stays a blocker — Done-when must lock the real `compareGateTrees` / pr-policy path with a #126 replay fixture and red proofs for real weakening.

## What Changes

- Keep the helpers already on main (`script-include-ratchet.mjs`, Codecov prefix cover, paired excludes); do not duplicate them.
- Extend the same path so a removed Stryker **positive** `mutate` entry is fine only when a remaining head glob covers it (same subsumption rule as coverage `include`).
- Fixture: real pre-#126 vs #126 head gate configs through `compareGateTrees` → 0 violations.
- Tests (real ratchet path): uncovered include/mutate removal, broad exclude (`!scripts/**`, `!src/**/*.ts`), non-thin CLI exclude, Codecov path dropped with no covering prefix — each red.
- No other gate loosened.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: pr-policy treats removed Stryker mutate positives via glob subsumption; Done-when scenarios for #126-style replay and real-weakening fails.

## Impact

- Code: `script-include-ratchet.mjs` (+tests), `check-gate-ratchet.mjs` (+tests), committed #126 config fixtures under `scripts/fixtures/`
- Out: app `src/**`; package.json/lockfile deps; other-session paths (`reimport-async` set); no gate floor changes
- Success: #126 replay fixture → 0 violations; each red case above (uncovered removal, broad exclude, non-thin CLI, uncovered Codecov drop) fails; `stryker:diff` ≥85 / 0 NoCoverage on the diff
- Risks: mutate subsumption is a new fail mode (strengthening only); fixture drift if someone rewrites history of 498ec7f (frozen copies, not live `git show`)
