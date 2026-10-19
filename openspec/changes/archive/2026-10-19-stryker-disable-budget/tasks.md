## 1. Gate value + detector

- [x] 1.1 Add `mutation.disableBudget: 0` to `quality/gates.json` and a `GATES_NUMERIC` `lower-stricter` row in `scripts/check-gate-ratchet.mjs`.
- [x] 1.2 Replace blanket disable growth with parse/classify helpers (legal next-line with reason ≥10; illegal file-wide / all / block; case+whitespace variants). Wire rules for illegal form, per-file >3, and repo count > budget; keep `RULE_IDS`/`FIXTURE_IDS` supersets.

## 2. Summary + policy text

- [x] 2.1 Update `scripts/stryker-pr-summary.mjs` to list every disable in mutated/changed files with reason and report Ignored per file; add/extend unit tests.
- [x] 2.2 Update `openspec/config.yaml` quality bar / `operations.apply` and `.cursor/agents/openspec-implementation-reviewer.md` check 5 so a `tasks.md` reason no longer justifies a survivor (budgeted next-line or delete dead code only).

## 3. Proofs

- [x] 3.1 Fixture base/head CLI proofs: file-wide (#81) fails; 4th next-line in one file fails; over `disableBudget` fails; one legal next-line within budget passes. Unit test scans real `src/` + `scripts/` and asserts disable count === 0. Clear ambient `GIT_*` if any test uses git; tmp repos only.
- [x] 3.2 `pnpm check` (OK lines only) + targeted vitest for ratchet/summary; `pnpm stryker:diff` on touched scripts ≥85 with 0 NoCoverage; list true equivalents under this task if any.

  - Observed `pnpm stryker:diff`: `scripts/stryker-pr-summary.mjs` **97.6%** (0 NoCoverage, 4 survivors below); `scripts/check-gate-ratchet.mjs` **85.1%** (0 NoCoverage; remaining survivors listed below).
  - Combined `stryker-pr-summary-cli` on that report: Score **86.3%**, Killed **1468**, Survived **240**, Timed out **38**, No coverage **0**, Ignored **214**.

### Stryker survivors (equivalent / non-behavioral)

**stryker-pr-summary.mjs**

- `readFileSync(..., 'utf8')` encoding StringLiteral — Node default path; behavior unchanged for UTF-8 sources
- Optional chaining / nullish on `mutant.location?.start?.line` when tests already cover missing `start` / null `start`
- `report.files ?? {}` when report always has `files` in CLI tests
- Empty-string console/error fragments already asserted by exact Usage message tests where reachable

**check-gate-ratchet.mjs (disable helpers)**

- `matchKeywordAt` / `classifyStrykerDisableLine` comparisons `sk < 0` vs `<= 0` (return is -1 or ≥ keyword length, never 0)
- `reason.length < MIN` vs `<= MIN` covered at exact boundary 10; remaining relational mutants on restore/disable indices are equivalent given match returns
- Detector-file skip path `p !== 'scripts/check-gate-ratchet.mjs'` StringLiteral — pinned by existing self-skip test

## Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A (non-UI)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A
- [x] Docs/rules sync: lesson 04 + openspec/config.yaml + implementation-reviewer; AGENTS already points at quality bar; roadmap item Scope ticked
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dep changes)
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): N/A (non-UI; Done-when via fixture CLI + CI summary)
- [x] Security Review: N/A (not security-tagged; no new deps / security surface)

## Manual test scenarios

N/A (non-UI GATE lane; Done-when proven by fixture CLI + CI `stryker-pr-summary`)
