# code-scout-first

Tag: lite
Milestone: P3
Title: Bug: /next-roadmap-item code-scout-first
Status: done

## Scope

- [x] `.claude/commands/next-roadmap-item.md`: explicit step right after preflight — start from the brief's `## Code map` and ask `code-scout` only what it leaves open; with no Code map, ONE `code-scout` call (files to change, callers, tests) before any own grep/read; own grep/sed after that only for pinpoint checks.
- [x] `.claude/agents/code-scout.md`: answer the standard question set (files to change, callers of changed symbols, unit tests, related e2e specs) when given a slug or brief; stays read-only and cheap (model and tools unchanged).
- [x] PR body: before/after of the command text, expected metric, one proposed line for `orchestrator/brief-rules.md`.
- **Done when:** the command makes code-scout (or the brief's Code map) the first step after preflight with a diff ≤15 lines in the command file; after merge the loop measures worker own search calls (Grep/Glob/grep/rg/git grep in main context) median ≤4 per run with first-pass review rate not lower.
- **Browser check:** none (agent process docs only).
