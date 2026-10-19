# Next roadmap item (unattended)

Run ONE roadmap item end to end in this session. Optional argument: a roadmap
slug (`/next-roadmap-item <slug>`) — pass it to preflight as `--slug <slug>`.
Without a slug, behaviour is unchanged (bare `roadmap next` + claimed set).
This message is the explicit request for planning, apply, manual check,
archive, PR and CI — do not stop between stages. Mandates live in
openspec/config.yaml (rules + operations), .cursor/rules/git-finish.mdc,
.cursor/agents and skill `roadmap`; follow them, do not restate them.

Token hygiene: do not re-read this command, alwaysApply rules, or `AGENTS.md`
(already injected). Do not re-read the item file after `roadmap next` / agent
preflight. Take `rules`/`template` from the preflight run card or
`pnpm agent instructions <artifact>` (raw `openspec instructions` /
`openspec/config.yaml` / openspec skills / agents reads are denied). Specs:
`rg` + targeted ranges — never `openspec show | head -c`. Exploration:
scoped grep ≤30 hits; offset/limit reads for files >400 lines; no re-read of
unchanged files; no TodoWrite in unattended `-p`. Tick item checkboxes with
targeted edits, not whole-file rewrites. Prefer `pnpm check` (until only OK
lines) and `pnpm test:e2e:changed:quiet` (once when green; CI burn-in owns
flake proof; local `--repeat-each=3` only if a flake failed then passed
locally). Generate the PR body once; cite issues as plain URLs only. Brief
reviewers via `pnpm agent review-brief --out <file> --base origin/main`
(Task gets skill set + brief path only) — no other-session transcripts.

Batching: independent reads/greps in one parallel tool step; dependent shell
steps chained with `&&` in one call; no check-then-recheck loops. OpenSpec
artifact stages: one Write per artifact, validate once at stage end.

1. Preflight: `source scripts/agent-env.sh` once, then
   `pnpm -s agent preflight --json` (or `… preflight --slug <slug> --json` when
   the command was invoked with a slug). Prefer `--json`; text mode also prints
   full rules/template/body. Clean tree required. Without `--slug`, syncs local
   `main` and skips claimed slugs (open PR + remote/local/worktree `feat|fix/*`).
   With `--slug`, branches from `origin/main` without switching local `main`
   (linked worktrees OK). Creates `feat/<slug>` (or `fix/`) and prints one
   compact report. Contingency items: take only when their gate failed
   (`pnpm -s roadmap show <slug>`). POSIX/WSL: `pnpm`/`openspec`/`gh`/`git` on
   PATH (openspec is a global CLI, not a repo dependency).
2. Plan with the OpenSpec CLI, not /opsx-propose (its planning boundary would end
   this run): `openspec new change <slug>` if preflight did not; for each ready
   artifact use the run card or `pnpm agent instructions <id>` → write it →
   `openspec status --change <slug> --json`. After proposal + design + tasks
   (+ specs when not skipped), launch `openspec-planning-reviewer` once
   (`pnpm -s agent review-brief --out <file>`; ≤1 delta re-review). Docs-only
   skips the design checklist. Over budget: grow the roadmap with
   `pnpm roadmap add <new-slug> --after <slug> ...`, not the PR.
3. Implement per `runCard.procedure` from step 1 preflight (`pnpm -s agent
preflight --json`) through the Verification checklist, including
   openspec-implementation-reviewer pass and the Manual check. Prefer quiet
   verify. Out of scope only if the same test fails/flakes on unmodified
   `origin/main`; otherwise fix in this PR (even if the file is outside the
   touch-set). Out-of-scope: `pnpm roadmap add … --after <slug>` or a bug issue,
   then continue — filing never makes a red PR mergeable. Code after
   implementation review → re-run that reviewer on the delta before archive.
4. `npx openspec archive <slug> -y`: answer "Sync now"; confirm only when every
   task is checked. Then close the item on this branch: `pnpm roadmap done <slug>`
   (`--note "..."` when the shipped scope deviates; required for a
   [contingency]). Done writes item-file Status only (no index tick / no
   milestone archive). Index sync / milestone archive: operator docs PR after
   merge (not in item PRs; `check` pending-sync warnings are expected).
5. `pnpm roadmap check`, then commit (agent owns the message). Finish with
   `pnpm -s agent finish --title "…" --body-file <pr-body.md>` (or omit create
   flags when updating an existing PR). At most 2 local push attempts inside
   finish; open/update the PR and stop — do not watch or poll CI
   (`gh pr checks --watch` forbidden); the reviewer reads checks.

Stop and ask only for: dirty tree, a milestone review cut, an item whose intent
contradicts a spec or open issue. Security-tagged items continue; run the
Security Review sub-agent before archive. Until `gate-ratchet` is merged, a
gate-config edit MUST be strictly stricter and listed in the touch-set with a
reason; otherwise stop. Until `docs/backlog/dependency-policy.md` is re-added
and merged, a new or changed dependency needs `pnpm audit:ci` evidence and a
Security Review pass before archive. Otherwise record assumptions in the
artifacts and continue.
Final reply in Russian: item, PR URL, check status (not watched / reviewer
reads CI), reviewer verdicts, skipped survivors, assumptions.
