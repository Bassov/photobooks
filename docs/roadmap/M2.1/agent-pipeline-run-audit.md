# agent-pipeline-run-audit

Tag: prep
Milestone: M2.1
Title: Check one /next-roadmap-item run against the #77 and #79 targets

## Scope

- [ ] Merges `agent-pipeline-token-check` and `agent-pipeline-call-count-check`. Run after phase 1–3 changes are on `main`, on the next comparable real item (not a meta item)
- [ ] `pnpm agent stats <transcript.jsonl>`: main-agent model calls, preflight calls, commit → CI-green calls, re-reads of injected files, untrimmed outputs, cumulative main input (owner points to the transcript file)
- [ ] Targets: preflight ≤ 2 calls, commit → CI-green ≤ 4, main-agent calls ≤ ~35, no re-reads of injected files, `openspec/config.yaml` at most once, main input under ~1.5M tokens. Survivors get one-line reasons or a next checkbox
- [ ] Record whether rtk was active on the machine (rtk adoption is deferred). MCP schema size: note which servers were enabled. Close #77 and #79 when targets are met or documented
- **Done when:** one checked run is recorded in the PR with the call and token numbers against every #77 / #79 target, each missed target has a reason or a next checkbox, and #77 / #79 are closed or carry a link to that record.
- **Size:** ~200 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #77 Done when 3, #79 Done when 2
