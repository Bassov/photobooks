# Next roadmap item (unattended)

Run ONE roadmap item end to end in this session. This message is the
explicit request for planning, apply, manual check, archive, PR and CI — do not
stop between stages. Mandates live in openspec/config.yaml (rules + operations),
.cursor/rules/git-finish.mdc, .cursor/agents and skill `roadmap`; follow them,
do not restate them.

Token hygiene: do not re-read this command, alwaysApply rules, or `AGENTS.md`
(already injected). Do not re-read the item file after `roadmap next` / agent
preflight. Take `rules`/`template` from preflight output or
`openspec instructions … --json`. Open `openspec/config.yaml` only for
`operations`, at most once. Specs: `rg` + targeted ranges — never
`openspec show | head -c`. Tick item checkboxes with targeted edits, not
whole-file rewrites. Prefer `pnpm verify:fast:quiet` / `pnpm test:e2e:quiet`.
Generate the PR body once; cite issues as plain URLs only. Brief reviewers via
`pnpm agent review-brief --base origin/main` (slug, change path, rules,
diff vs base, touch-set) — no other-session transcripts.

Batching: independent reads/greps in one parallel tool step; dependent shell
steps chained with `&&` in one call; no check-then-recheck loops. OpenSpec
artifact stages: one Write per artifact, validate once at stage end.

1. Preflight: `source scripts/agent-env.sh` once, then
   `pnpm -s agent preflight --json` (prefer `--json`; text mode also prints
   full rules/template/body). Clean tree required; it syncs `main`, skips
   open-PR/remote `feat|fix/*` slugs, runs `roadmap next`, creates
   `feat/<slug>` (or `fix/`), and prints one compact report. State item,
   tag and skips from that report. Contingency items: take only when their
   gate failed (`pnpm -s roadmap show <slug>`). POSIX/WSL: `pnpm`/`openspec`/
   `gh`/`git` on PATH (openspec is a global CLI, not a repo dependency).
2. Plan with the OpenSpec CLI, not /opsx-propose (its planning boundary would end
   this run): `openspec new change <slug>` if preflight did not; for each ready
   artifact `openspec instructions <id> --change <slug> --json` → write it →
   `openspec status --change <slug> --json`. Launch the reviewer subagents where
   rules.proposal / rules.design require (brief with `pnpm -s agent review-brief`)
   and loop to pass. Over budget: grow the roadmap with
   `pnpm roadmap add <new-slug> --after <slug> ...`, not the PR.
3. /opsx-apply <slug> through the Verification checklist, including
   openspec-implementation-reviewer pass and the Manual check. Prefer quiet
   verify. Out of scope only if the same test fails/flakes on unmodified
   `origin/main`; otherwise fix in this PR (even if the file is outside the
   touch-set). Out-of-scope: `pnpm roadmap add … --after <slug>` or a bug issue,
   then continue — filing never makes a red PR mergeable; 3 red CI rounds still
   stop. Code after implementation review → re-run that reviewer on the delta
   before archive.
4. /opsx-archive <slug>: answer "Sync now"; confirm only when every task is
   checked. Then close the item on this branch: `pnpm roadmap done <slug>`
   (`--note "..."` when the shipped scope deviates; required for a
   [contingency]). If it reports a milestone review cut, commit the archive
   move and stop after the PR is green.
5. `pnpm roadmap check`, then commit (agent owns the message). Finish with
   `pnpm -s agent finish --title "…" --body-file <pr-body.md>` (or omit create
   flags when updating an existing PR). At most 2 local push attempts inside
   finish; then stop and report in the PR description.

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
