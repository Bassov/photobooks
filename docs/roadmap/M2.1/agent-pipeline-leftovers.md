# agent-pipeline-leftovers

Tag: prep
Milestone: M2.1
Title: Remaining token and call waste in the agent pipeline (issues #77, #79)

## Scope

- [ ] `pnpm agent finish`: run `verify:fast` once per push (today `verify:fast:quiet` runs and then pre-push runs `verify:fast` again); parse the pre-push result instead of re-running. Never `--no-verify`
- [ ] `finish` reads the CI report JSON (`pr-metrics-autogen`) for the summary instead of separate `gh pr checks` + log calls; `--log-failed` tail only on red
- [ ] `preflight`: warn and rebase-or-recreate when the reused local branch is behind `origin/main`; include the `quality/review-checklist.md` ids, not the text
- [ ] `roadmap` / `openspec instructions` output: compact defaults where the agent only needs `{template, rules}` (the "polish as needed" left open in `agent-pipeline-fewer-calls`)
- [ ] Tests at the `scripts/agent.mjs` bar
- **Done when:** one `pnpm agent finish` happy path runs `verify:fast` exactly once and makes one CI-summary call, `preflight` flags a stale branch, and the agent tests cover each change.
- **Size:** ~400 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #77, #79; PR #81 N3/N6
