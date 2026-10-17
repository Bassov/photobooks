# rtk-adopt

Tag: prep
Milestone: M2.1
Title: compact shell output for the agent with rtk (issue #79 §5)

## Scope

- [ ] **Agent installs it** on the machine where the Cursor agent runs (owner WSL): `rtk-oss` (Apache-only edition; filters only, no BUSL engine), a version whose hook applies trusted TOML filters (fix rtk-ai/rtk#2748 or later), plus `jq` (required by the Cursor hook)
- [ ] Cursor hook: `rtk init -g --agent cursor` (preToolUse in `~/.cursor/hooks.json`), or a project-level `.cursor/hooks.json` if Cursor/rtk support it for this repo; restart Cursor. `awareness.level = "default"` so instructions stay out of the context
- [ ] Verify the rewrite: `rtk rewrite "git status"` → `rtk git status`, and one `pnpm` command in the agent shell returns condensed output with the real exit code (a failing `pnpm test:quiet` on a scratch branch still exits non-zero and shows the failing test)
- [ ] Check which project commands rtk compresses: `pnpm verify`, `verify:fast(:quiet)`, `test:e2e(:quiet)`, `stryker:diff`, `openspec …`, `gh pr checks`, `pnpm agent finish`. Add `.rtk/filters.toml` (committed, then `rtk trust`) for the ones it passes through, if the DSL supports them; failures and summaries are never filtered out
- [ ] `AGENTS.md` (Toolchain): install + init steps, `RTK_DISABLED=1` / `rtk bypass` escape hatch, "Read/Grep built-ins are not intercepted, prefer shell `rg`", and that rtk is a local machine add-on: CI and other agents do not have it, so the #77 quiet conventions (`verify:fast:quiet`, `test:e2e:quiet`, trimmed push/CI output, `pnpm agent` compact JSON) stay the baseline and are not removed; replace the AGENTS.md “Pipeline MCP” sentence that points to the removed `agent-pipeline-call-count-check`
- [ ] No before/after measurement and no adopt-or-drop decision: adoption is decided (owner, 18.10.2026). First item of M2.1 so the flake work (many repeat runs) already gets compact output
- **Done when:** rtk is installed and active in the agent's shell on the owner's WSL machine, verified by a rewritten `git` command and a condensed `pnpm` command that keeps its exit code; `AGENTS.md` documents setup and the escape hatch; `.rtk/filters.toml` covers the project commands rtk does not compress natively (or the PR lists why a command cannot be filtered); the #77 quiet scripts are unchanged.
- **Size:** ~150 (docs/config) changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #79 §5, #77 §3
- **Note:** Security surface: a global preToolUse hook rewrites agent shell commands. Security Review sub-agent checks that exit codes and error lines survive filtering.
