# Next roadmap item (unattended)

Run ONE roadmap item end to end in this session. This message is the
explicit request for planning, apply, manual check, archive, PR and CI — do not
stop between stages. Mandates live in openspec/config.yaml (rules + operations),
.cursor/rules/git-finish.mdc, .cursor/agents and skill `roadmap`; follow them,
do not restate them.

Token hygiene: do not re-read this command, alwaysApply rules, or `AGENTS.md`
(already injected). Do not re-read the item file after `roadmap next`. Take
`rules`/`template` from `openspec instructions … --json` (e.g. pipe through a
JSON filter for those keys). Open `openspec/config.yaml` only for `operations`,
at most once. Specs: `rg` + targeted ranges — never `openspec show | head -c`.
Tick item checkboxes with targeted edits, not whole-file rewrites. Prefer
`pnpm verify:fast:quiet` / `pnpm test:e2e:quiet`; trim push/CI logs (`tail`).
Generate the PR body once; cite issues as plain URLs only. Brief reviewers with
slug, change path, relevant `rules`, `git diff --stat`, and touch-set
working-tree diff — no other-session transcripts.

1. Preflight: `git status` clean (else stop). Source once:
   `source scripts/agent-env.sh` (or `. scripts/agent-env.sh`). Then
   `git fetch origin && git switch main && git pull --ff-only`.
2. Collect slugs with an open PR or remote branch (`gh pr list --state open`,
   `git branch -r`; branch `feat/<slug>` or `fix/<slug>`), then
   `pnpm -s roadmap next --skip <slugs>`. Its output (slug, tag, milestone goal,
   title, file, full scope) is the item; do not read docs/roadmap.md. It skips
   [contingency] items; take one only when its gate has failed
   (`pnpm -s roadmap show <slug>`). State item, tag and skips.
   `git switch -c feat/<slug>` (fix/ for bug items).
3. Plan with the OpenSpec CLI, not /opsx-propose (its planning boundary would end
   this run): `openspec new change <slug>`; for each ready artifact
   `openspec instructions <id> --change <slug> --json` → write it →
   `openspec status --change <slug> --json`. Launch the reviewer subagents where
   rules.proposal / rules.design require and loop to pass. Over budget: grow the
   roadmap with `pnpm roadmap add <new-slug> --after <slug> ...`, not the PR.
4. /opsx-apply <slug> through the Verification checklist, including
   openspec-implementation-reviewer pass and the Manual check. Prefer quiet
   verify. Out of scope only if the same test fails/flakes on unmodified
   `origin/main`; otherwise fix in this PR (even if the file is outside the
   touch-set). Out-of-scope: `pnpm roadmap add … --after <slug>` or a bug issue,
   then continue — filing never makes a red PR mergeable; 3 red CI rounds still
   stop. Code after implementation review → re-run that reviewer on the delta
   before archive.
5. /opsx-archive <slug>: answer "Sync now"; confirm only when every task is
   checked. Then close the item on this branch: `pnpm roadmap done <slug>`
   (`--note "..."` when the shipped scope deviates; required for a
   [contingency]). If it reports a milestone review cut, commit the archive
   move and stop after the PR is green.
6. `pnpm roadmap check`, then commit, PR and wait for green per git-finish.mdc.
   At most 2 local push attempts; then stop and report in the PR description.

Stop and ask only for: dirty tree, a milestone review cut, an item whose intent
contradicts a spec or open issue, the git-finish CI stop conditions. Security-tagged
items continue; run the Security Review sub-agent before archive. Until
`gate-ratchet`/`gate-ratchet-ci` are merged, a gate-config edit MUST be strictly
stricter and listed in the touch-set with a reason; otherwise stop. Until
`dependency-policy` is merged, a new or changed dependency needs `pnpm audit:ci`
evidence and a Security Review pass before archive. Otherwise record assumptions
in the artifacts and continue.
Final reply in Russian: item, PR URL, check status, reviewer verdicts, skipped
survivors, assumptions.
