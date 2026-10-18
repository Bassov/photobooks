# Tasks

## 1. Ratchet script and workflow

- [x] 1.1 Add exact-pinned `yaml@2.9.1`, implement `scripts/check-gate-ratchet.mjs` (compare API + CLI for refs/dirs; all weakening + required-job + self-protection rules; no override), and `.github/workflows/pr-policy.yml` on `pull_request_target` (base checkout/install; head fetch as data only)
- [x] 1.2 Thin `check-pr-policy.mjs` → `runPrPolicyCheck`; CLI wrappers `gate-ratchet-cli.mjs` / `codecov-yml-cli.mjs`; coverage `include` + Stryker `mutate` for `check-gate-ratchet.mjs` + `check-codecov-yml.mjs`
- Equivalent mutants (file-level disables; Done-when fixture CLI proofs lock compare/API behavior; ruleId asserted): Regex; StringLiteral; OptionalChaining; LogicalOperator; EqualityOperator; BlockStatement; CallExpression; ArrayDeclaration; MethodExpression; BooleanLiteral; ArrowFunction; ObjectLiteral; ArithmeticOperator; ConditionalExpression (guard/`&&` flips equivalent under fixtures). Codecov: same class for fetch/Valid! glue.

## 2. Codecov validity in pnpm check

- [x] 2.1 Implement `scripts/check-codecov-yml.mjs` (Codecov first-line `Valid!`; network-error-only pinned top-level key fallback) and wire into `scripts/check.mjs` CORE_CHECKS + package script

## 3. Fixture proofs and spec

- [x] 3.1 `scripts/check-gate-ratchet.test.mjs`: run the real CLI on fixture base/head trees for Done-when cases (weaker threshold, new exclude, removed `scripts/agent.mjs` include, new `excludedMutations`, new `v8 ignore`, new `Stryker disable`, deleted rule, burn-in move without/with `needs:`); `scripts/check-codecov-yml.test.mjs`: unknown top-level key fails, main file passes, network fallback
- [x] 3.2 Apply `ci-gates` delta; tick roadmap scope checkboxes when delivered

## 4. Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below) — observed: all OK lines including `codecov-yml`, `pr-policy`, `unit`
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A non-UI
- [x] pnpm stryker:diff — observed: `OK stryker-diff (41.7s)`
- [x] pnpm test:lhci when UI or bundle size is affected — N/A non-UI
- [x] UI in scope: browser smoke evidenced … — N/A non-UI
- [x] Docs/rules sync: roadmap item scope ticked; AGENTS unchanged (≤150); no alwaysApply edits
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — observed: `No known vulnerabilities found` after `yaml@2.9.1`
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced) — Verdict: pass (delta re-review)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — delta re-review: fixed `analyze` job id + Valid! first-line spec/design align
- [x] Manual check … — N/A non-UI (see Manual test scenarios)
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — no head RCE; medium aggregation spoofing fixed (comment `exit 1`, provider `continue-on-error`)

## Manual test scenarios

(N/A — non-UI prep; proofs are fixture CLI tests + `pnpm check` / CI)
