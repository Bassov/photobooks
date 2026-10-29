# stryker-diff-scope

Tag: prep
Milestone: M3
Title: Measure stryker-diff cost and survivors; Owner picks keep / exclude / C-session
Status: done

## Scope

Owner-approved agent-pipeline-plan-2026-10-28 §2.3 / §3.2, photobooks side only. Measurement and a written Owner decision packet; no gate change.

Measure stryker-diff cost/survivors for 1 week; Owner picks (a) keep / (b) exclude listed low-value mutators via quality/gates.json / (c) move stryker-diff to dedicated C-session brief. No threshold change in this PR.

- Ledger lives in the gitignored `.local_dev/stryker-ledger.md` (per red: date, PR, file, mutant, fix type, cost; plus analysis section).
- Hard nos: stryker thresholds stay (diff break 85), no new Stryker disables, no `quality/gates.json` mutator excludes, required check not moved.

## Done when

- Ledger covers every red stryker-diff since 2026-10-28 (#262, #263, #264) with "unknown" where a number is not in the sources.
- The PR body ends with an Owner decision ask: one of (a)/(b)/(c) recommended with evidence from the ledger.
- No gate, threshold, mutator or required-check change in the diff. Implementing (b) or (c) is a separate item after the Owner decides.
