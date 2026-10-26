# agent-pipeline-run-audit

Tag: prep
Milestone: M2.1
Title: Check one /next-roadmap-item run against the #77 and #79 targets

## Scope

- [ ] Merges `agent-pipeline-token-check` and `agent-pipeline-call-count-check`. Run after phase 1–3 changes are on `main`, on the next comparable real item (not a meta item)
- [ ] `pnpm agent stats <transcript.jsonl>`: main-agent model calls, preflight calls, stage markers (apply A loops, first B, phase commits, impl review, QA, archive, stage 11 stamp, thin finish, optional `ci-brief`), re-reads of injected files, untrimmed outputs, cumulative main input (owner points to the transcript file)
- [ ] Targets (re-baselined for agent-loop stages; survivors get one-line reasons or a next checkbox):
  - preflight ≤ 2 calls
  - first green B → stage-5 commit, then later phases, then stage 12 thin finish → PR URL (no fat finish verify; no CI watch) — count main-agent rounds for that span; treat ≤ ~8 as the replacement for old “commit → CI-green ≤ 4” (document actuals)
  - main-agent calls ≤ ~35
  - no re-reads of injected files; `openspec/config.yaml` at most once
  - main input under ~1.5M tokens; peak context per session ≤300K; first-round main input ≤400K (`pnpm agent stats`)
  - apply loops use `check:fast` only (no stryker in A); B at most once per applicable phase (4 / 7 / 9)
- [ ] Record whether rtk was active on the machine (rtk adoption is deferred). MCP schema size: note which servers were enabled. Close #77 and #79 when targets are met or documented
- **Done when:** one checked run is recorded in the PR with the call and token numbers against every #77 / #79 target (and the stage-loop bullets above), each missed target has a reason or a next checkbox, and #77 / #79 are closed or carry a link to that record.
- **Size:** ~200 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #77 Done when 3, #79 Done when 2; agent-loop stages redesign
- **Reason:** owner 2026-10-27: product first (finish the editor on the kit v0.9.3 chrome, then the personal site); quality-gate and audit work waits until the owner re-adds it.
