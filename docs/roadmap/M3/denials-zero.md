# denials-zero

Tag: prep
Milestone: M3
Title: Cut headless permission denials (run card + scratch dir)
Status: done

## Scope

Owner-approved agent-pipeline-plan-2026-10-28 §2.1: docs-only. Run card (`docs/agent-loop.md` stage 0, Harnesses; `next-roadmap-item.md`; `AGENTS.md`) now says: env preloaded by the launcher (no `source` headless), scratch in `.cache/agent/` (already gitignored), no `timeout` wrapper, `Edit` not `sed -i`/`python3`, no `cd`/`git -C`. Deny rules untouched. Preflight auto-creating `.cache/agent/` is a ts-agent-rig change (external).
