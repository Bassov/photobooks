# Next roadmap item (unattended)

Run ONE roadmap item end to end. Optional `/next-roadmap-item <slug>` →
preflight `--slug <slug>`. Without slug: bare `roadmap next` + claimed set.
This message authorizes plan → apply → manual → archive → PR → CI fix loop.

**SoT:** execute [`docs/agent-loop.md`](../../docs/agent-loop.md) stages 0–13.
Artifact how: `openspec/config.yaml`. Reviewers: `.cursor/agents` (Claude:
subagents of the same name). Roadmap:
skill `roadmap`. Finish precedence: `.cursor/rules/git-finish.mdc`.

Token hygiene: do not re-read this command, alwaysApply rules, or `AGENTS.md`.
Do not re-read the item after `roadmap next` / preflight. Take rules/template
from the run card or `pnpm agent instructions <artifact>` (native; do not
re-read openspec/config.yaml or .cursor/agents). Specs: `rg` + ranges — never
dump whole specs. Grep ≤30 hits; offset/limit if >400 lines; no re-read; no
TodoWrite in `-p`. Tick checkboxes with targeted edits. Brief via
`pnpm agent review-brief --out <file> --base origin/main` (Task: skill set +
brief path only). Ignore `openspec/changes/archive/**` in search.

Batch: parallel independent reads; dependent shell with `&&`. One Write per
OpenSpec artifact; validate once per stage.

1. Preflight: `source scripts/agent-env.sh` once, then
   `pnpm -s agent preflight --json` (or `… --slug <slug> --json`). Clean tree.
   Without `--slug`, syncs `main` and skips claimed slugs. With `--slug`,
   branches from `origin/main` (worktrees OK). Creates `feat|fix/<slug>`.
   Contingency: only when its gate failed (`pnpm -s roadmap show <slug>`).
2. Execute `docs/agent-loop.md` from plan through thin finish (stage 12).
   Prep/contingency fast-track and oversize → `roadmap add --after` per
   `openspec/config.yaml` / loop SoT. Out-of-scope fails: fix in this PR unless
   same failure on unmodified `origin/main`; else `pnpm roadmap add … --after`
   or a bug issue — filing never greens a red PR. Code after review → re-run
   implementation reviewer on the delta.
3. After the PR URL: `pnpm agent ci-wait` (stages 12–13). CI red:
   `pnpm agent ci-brief` → fix → push → `ci-wait`. Never `gh pr checks --watch`.

Stop only for: dirty tree, milestone review cut, intent vs spec/issue conflict.
Security-tagged: Security Review before archive. Gate-config edits must be
stricter and touch-set listed. New/changed deps need `pnpm audit:ci` + Security
Review until dependency-policy is re-added. Else record assumptions and continue.
Final reply in Russian: item, PR URL, required-check status, reviewer
verdicts, skipped survivors, assumptions.
