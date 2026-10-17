# agent-pipeline-call-count-check

Tag: prep
Milestone: M2.1
Title: Check call-count + rtk trial for issue #79

## Scope

- [ ] Run one `/next-roadmap-item` (or equivalent) after a comparable real item is on `main` (prefer after `agent-pipeline-token-check` / same comparable run as #77) and check the transcript against issue #79 targets: preflight ≤ 2 model calls, commit → CI-green ≤ 4 on the happy path, main-agent model calls ≤ ~35 (vs 66)
- [ ] **Owner (WSL):** trial `rtk-oss` (`rtk init -g --agent cursor`): which commands compress, tokens before/after vs 17 Oct transcript; adopt or drop (vs token-trim); document if adopt
- [ ] Measure MCP tool-schema surface size before/after disabling unused Cursor MCP servers for this project (issue #79 §4); record one-line result
- [ ] Record survivors with one-line reasons; close https://github.com/Bassov/photobooks/issues/79 when targets met or documented
- **Done when:** one checked run shows call-count targets (or documented why not with follow-ups), MCP schema before/after noted, and an rtk adopt/drop decision is recorded
- Refs: https://github.com/Bassov/photobooks/issues/79
