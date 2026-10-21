# Next roadmap item (unattended)

Run ONE roadmap item end to end. Optional `/next-roadmap-item <slug>` →
preflight `--slug <slug>`. Without slug: bare `roadmap next` + claimed set.
This message authorizes plan → apply → manual → archive → PR (no CI watch).
Mandates: openspec/config.yaml, git-finish.mdc, .cursor/agents, skill `roadmap`.

Token hygiene: do not re-read this command, alwaysApply rules, or `AGENTS.md`.
Do not re-read the item after `roadmap next` / preflight. Take rules/template
from the run card or `pnpm agent instructions <artifact>` (native; do not
re-read openspec/config.yaml or .cursor/agents). Specs: `rg` + ranges — never
dump whole specs. Grep ≤30 hits; offset/limit if >400 lines; no re-read; no
TodoWrite in `-p`. Tick checkboxes with targeted edits. Prefer `pnpm check:fast`
(A; OK lines only). B = `pnpm test:e2e:changed:quiet` + `pnpm stryker:diff` at
stages 4/7/9 (once when green; CI burn-in owns flake proof). No commit until
first green B (stage 5). PR body stage 10; issue URLs only. Brief via
`pnpm agent review-brief --out <file> --base origin/main` (Task: skill set +
brief path only). Ignore `openspec/changes/archive/**` in search.

Batch: parallel independent reads; dependent shell with `&&`. One Write per
OpenSpec artifact; validate once per stage.

1. Preflight: `source scripts/agent-env.sh` once, then
   `pnpm -s agent preflight --json` (or `… --slug <slug> --json`). Clean tree.
   Without `--slug`, syncs `main` and skips claimed slugs. With `--slug`,
   branches from `origin/main` (worktrees OK). Creates `feat|fix/<slug>`.
   Contingency: only when its gate failed (`pnpm -s roadmap show <slug>`).
2. Plan via native agent OpenSpec (no openspec CLI): change dir from preflight;
   write ready artifacts from run card / `pnpm agent instructions`.
   Prep/contingency fast-track (`runCard.prepFastTrack`): brief proposal+tasks;
   skip design.md unless arch/security (`.skip-design`); `skip_specs: true` /
   `.skip-specs` when no `src/` capability behavior change; skip
   planning-reviewer — except when the item adds a missing `src/<capability>/`
   (full design + planning-reviewer). Else after proposal+design+tasks(+specs):
   planning-reviewer once (brief --out; ≤1 re-review; docs-only skips design).
   Over guidance: `pnpm roadmap add … --after`.
3. Implement per `runCard.procedure` through A loops + B phases +
   openspec-implementation-reviewer + Manual check. Quiet `check:fast`.
   Out-of-scope fails: fix in this PR unless same failure on unmodified
   `origin/main`; else `pnpm roadmap add … --after` or a bug issue — filing
   never greens a red PR. Code after review → re-run implementation reviewer
   on the delta.
4. `pnpm agent archive <slug>` (sync deltas first). Then
   `pnpm roadmap done <slug>` (`--note` when scope differs; required for
   contingency). Done writes item Status only.
5. Stage 10: PR body. Stage 11: `pnpm check:integrity` +
   `pnpm quality:self-check` + `pnpm agent stamp-green`. Stage 12: thin
   `pnpm -s agent finish --title "…" --body-file <pr-body.md>` (push+PR only;
   ≤2 local push attempts; no merge main; no C2 in finish). Stop after PR URL —
   no `gh pr checks --watch`. CI red: `pnpm agent ci-brief`.

Stop only for: dirty tree, milestone review cut, intent vs spec/issue conflict.
Security-tagged: Security Review before archive. Gate-config edits must be
stricter and touch-set listed. New/changed deps need `pnpm audit:ci` + Security
Review until dependency-policy is re-added. Else record assumptions and continue.
Final reply in Russian: item, PR URL, check status (not watched), reviewer
verdicts, skipped survivors, assumptions.
