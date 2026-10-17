# agent-pipeline-token-budget

Tag: prep
Milestone: M2.1
Title: Cut /next-roadmap-item token waste (issue #77)

## Scope

- [x] Pre-push (lefthook) runs `pnpm verify:fast` only; Playwright stays a CI PR gate (unchanged quality bar)
- [x] Out-of-scope gate failure (outside the item's touch-set) is not fixed in the current PR — file with `pnpm roadmap add … --after <current>` or a bug issue for a flake, then move on; CI decides
- [x] At most 2 local push attempts; then stop and report in the PR description instead of looping
- [x] Any code change after implementation review re-runs the implementation reviewer on that delta
- [x] `/next-roadmap-item` and RULES: do not re-read files already injected (command, alwaysApply rules, `AGENTS.md`); do not re-read the item file after `roadmap next`
- [x] Take rules from `openspec instructions` (pipe through `jq '{template,rules}'`); read `openspec/config.yaml` only for `operations`, at most once
- [x] Read a spec once and only the requirements being changed (`rg` + targeted range); never `openspec show | head -c`
- [x] Update item files with targeted edits (tick boxes), not whole-file rewrites
- [x] Quiet command conventions: `verify:fast:quiet` / `test:e2e:quiet`, push/CI output trimmed (`tail`); CI wait silent then JSON summary
- [x] Reviewer briefs: slug, change path, relevant `rules` array, `git diff --stat` + touch-set working-tree diff; no other-session transcripts; no tool discovery
- [x] `scripts/agent-env.sh` + AGENTS note so Node/pnpm work in non-interactive shells (no `.tool-versions` in the tree)
- [x] Generate the PR body once; paste issues as plain URLs, not GitHub page HTML
- [x] `agent-context` spec covers the above; README Lefthook line matches pre-push
- **Done when:** pre-push is `verify:fast`; e2e still gates every PR in CI; no coverage/mutation weakening; a comparable `/next-roadmap-item` run avoids re-reads of injected files, reads `config.yaml` at most once, has no untrimmed test/push/CI dumps, does not fix out-of-scope failures, and uses narrow reviewer briefs (target: main input under ~1.5M for a comparable item)
- Issue: https://github.com/Bassov/photobooks/issues/77
