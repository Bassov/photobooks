# worker-batch-tool-calls

Tag: lite
Milestone: P2
Title: worker-batch-tool-calls: headless workers send independent tool calls in one message

Process item P-20261104-1530-1 (tag: process; Owner 2026-11-04 «Делай 1–4»). Why: orch token analysis 2026-11-04: 73% of worker turns have one tool call; each turn re-reads ~92K context (cache reads = 70% of worker cost); exploration + edit turns = ~66% of worker cost.

## Scope

- [x] CLAUDE.md `## Claude Code` (the deltas section): one line: "Batch independent tool calls in one message (several Grep/Read/`git grep`/`sed -n` of different files; Edits in different files); go one at a time only when a result decides the next call." Pointer only, no copy into `.claude/`.
- [x] If `quality/gates.json` `agentRules.budgets` would be exceeded, shorten another CLAUDE.md delta line rather than raising the budget. (Not needed: 11/18 lines, 790/900 chars.)
- Removes: nothing.
- Hard nos: no new skill, no change to gates or tests; do not touch `.cursor/` rules text.
- **Done when:** CLAUDE.md has the line; `pnpm check:integrity` green; the rules budget is not raised (PR body shows the CLAUDE.md count before/after).
- **Browser check:** N/A (process docs; no product code).
