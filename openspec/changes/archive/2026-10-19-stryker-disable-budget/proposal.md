# Proposal

## Why

**Problem:** Gate-ratchet forbids every `Stryker disable`, so agents still list survivors in `tasks.md` instead of a budgeted next-line form; illegal file-wide / block disables (PR #81) are not distinguished from a reasoned next-line.

**Why now:** M2.1 review cut — after `gate-ratchet` + `gate-weakening-guard`, define the only legal disable shape and a shrink-only repo budget so `pr-policy` and mutation reporting enforce it.

## What Changes

- Legal form only: `// Stryker disable next-line <Mutator>[,…]: <reason>` (reason ≥ 10 chars). File-wide, `disable all`, and block `disable`/`restore` fail `pr-policy`.
- Per-file cap 3; `mutation.disableBudget` in `quality/gates.json` starts at current count (0 on `main`), join existing numeric ratchet (can only shrink).
- `stryker-pr-summary.mjs`: list every disable in changed files with reason; Ignored mutants counted per file in the CI report.
- `openspec/config.yaml` apply + implementation-reviewer check 5: a `tasks.md` reason no longer justifies a survivor — delete dead code or use the budgeted next-line form.
- Extend `check-gate-ratchet` / detector conventions (whitespace/case must not bypass); fixture CLI Done-when proofs + real `src/`/`scripts/` scan asserting count 0.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ci-gates`: budgeted next-line Stryker disables; illegal forms and over-budget fail `pr-policy`; summary lists disables + Ignored.
- `agent-context`: budgeted next-line replaces blanket “no Stryker disable”; survivors in `tasks.md` no longer excuse.

## Impact

**Scope in:** ratchet detectors + fixtures; `quality/gates.json`; `stryker-pr-summary`; openspec/agent reviewer text; `ci-gates` + `agent-context` deltas.

**Scope out:** Product UI; GitHub required-check settings; raising the budget above 0; other gate floors.

**Success criteria:** Fixture: file-wide (#81) fails; 4th next-line in one file fails; count > `disableBudget` fails; one legal next-line with budget room passes and appears in summary with reason. Real repo scan count = 0. CI `stryker-pr-summary` numbers observed on this PR.

**Risks:** Detector false negatives on exotic comment shapes (mitigate case/whitespace tests + real-repo scan); `pull_request_target` stays base-exec / head-as-data.
