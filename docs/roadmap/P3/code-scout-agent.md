# code-scout-agent

Tag: lite
Milestone: P3
Title: Bug: /next-roadmap-item code-scout-agent
Status: done

Process item P-20261114-0153-1 (Owner 2026-11-14: route code reading through a cheap explore-style subagent). Why: workers spend ~half of their main-thread calls reading code (grep / `git grep` / `sed -n` / `cat` + Read); each call re-reads the whole ~84K context on Opus.

## Scope

- [ ] `.claude/agents/code-scout.md` (new): `name: code-scout`, `model: haiku`, read-only `tools: Read, Grep, Glob, Bash` (frontmatter copied from the existing agents). Bash only for `git grep`, `grep`, `sed -n`, `ls`, `git log`, `git show`. Output: one line per hit `path:line — what is there`, ≤10-line excerpts only where needed; no opinions, no fixes.
- [ ] `AGENTS.md` and `docs/agent-loop.md`, next to the hygiene rules: map the code with ONE `code-scout` call before editing; own grep/sed only for pinpoint checks; batch the rest in one Bash call. 2–4 lines each.
- Removes: nothing. If the `AGENTS.md` rules budget would be exceeded, shorten other lines instead of raising it.
- Hard nos: no product code (`src/**`, `e2e/**`, `uikit/**`), no other `.claude/` files, no CI workflows.
- **Done when:** the agent file exists with `model: haiku` and read-only tools; a smoke Agent call (subagent_type `code-scout`) returns a map, and the PR body shows the call and its output length in lines; `AGENTS.md` + `docs/agent-loop.md` mention it next to hygiene; `pnpm check:integrity` green.
- **Browser check:** N/A (process docs; no product code).
