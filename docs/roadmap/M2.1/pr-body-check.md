# pr-body-check

Tag: prep
Milestone: M2.1
Title: machine-checked PR body: verdicts, dispositions, scenarios (issue #72 G)

## Scope

- [ ] `.github/PULL_REQUEST_TEMPLATE.md` sections: Summary, OpenSpec, Reviewer verdicts (one line per reviewer: verdict + each finding's disposition `fixed` / `scheduled as <slug>` / `accepted: <reason>`), Manual test scenarios (steps, expected, observed), Gate changes (stricter only), New roadmap items, Metrics (generated block, `pr-metrics-autogen`), Skipped / risk (one or two lines). Preview-run automation stays in `docs/backlog/preview-qa-run.md` until re-added
- [ ] `scripts/check-pr-body.mjs` in `pr-policy` (also on `edited`): fails when a section is missing or empty, a verdict is not `pass`, a critical or high finding has no disposition, a scenario lacks an expected or observed result, or a slug under "New roadmap items" is not in the head index
- [ ] Verdicts are tied to the head: each verdict line carries the SHA it reviewed; a verdict older than the last code commit fails (re-review after post-review changes)
- [ ] Ticks need proof: the PR template gets a `## Done-when proofs` section with one line per checkbox the PR ticks in its roadmap item (scope boxes and Done-when), each naming a test (`file::title`), a CI run/check link, or a scratch PR number. `check-pr-body.mjs` diffs the item file against the base: a box ticked in this PR without a matching proof line, or `Status: done` while a Done-when proof is missing or says "left to reviewer", fails `pr-policy`.
- **Done when:** a PR body with a missing verdict, a `fix` verdict, a verdict on an older SHA than the last code commit, or a scenario without an expected result fails `pr-policy`; a complete body passes; a body that ticks a roadmap box without a proof line (repro of #110 r1: `Status: done`, all boxes ticked, proofs left to reviewer) fails `pr-policy`, and the same body with proof lines passes.
- **Size:** ~600 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 G; PR #76 F7; review findings #96 r1, #97 r1+r2, #110 r1 (done-criteria honesty; owner decision 2026-10-19)
