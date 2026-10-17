# agent-pipeline-fewer-calls

Tag: prep
Milestone: M2.1
Title: Fewer /next-roadmap-item tool calls (issue #79)

## Scope

- [x] `scripts/agent.mjs` + `pnpm agent`: `preflight`, `finish`, `review-brief`; `--json` / short-on-success; no ANSI when `CI`/`--quiet`
- [x] `preflight`: env, clean tree, sync main, skip-list, `roadmap next --skip`, create branch, one compact report (item + `{template,rules}` + touch-set path)
- [x] `finish`: `verify:fast:quiet` → commit check → push ≤2 fails → open/update PR → CI watch → one-screen summary (`--log-failed` tail on red)
- [x] `review-brief`: slug, change path, rules, `git diff --stat`, touch-set diff
- [x] Wire `next-roadmap-item.md` to agent commands + batching guidance; compact output polish on agent/roadmap as needed
- [x] `AGENTS.md`: `pnpm agent` + minimal MCP surface for the pipeline; delta `agent-context` (composite stages, batching, MCP)
- [x] Tests for `agent.mjs` at roadmap CLI bar; no gate weakening
- **Done when:** CLI wired into command; tests green; PR notes #79 URL; measurement/rtk deferred to `agent-pipeline-call-count-check` (now `agent-pipeline-run-audit`; rtk deferred)
- **Note:** this PR does not close #79 — call-count + rtk trial stay in `agent-pipeline-call-count-check` (now `agent-pipeline-run-audit`; rtk deferred)
- Issue: https://github.com/Bassov/photobooks/issues/79

## Done note

CLI + command/AGENTS/agent-context shipped; call-count + rtk deferred to agent-pipeline-call-count-check (now `agent-pipeline-run-audit`; rtk deferred); does not close issue #79
