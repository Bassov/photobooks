## Problem

Per-change agent mandates are split across Cursor rules and OpenSpec config, so checklists drift. Agents rediscover module layout each session. Archive can skip syncing delta specs into main specs.

## Why now

Photo-card and preview-hosting slices already rely on OpenSpec; without a single config SoT and agent map, the next slices will amplify drift and missed syncs.

## Scope in

- `openspec/config.yaml` as sole SoT for propose/design/tasks/apply/archive mandates (reviewers, verify, agent-docs sync, security gates, **always sync specs on archive**).
- Root `AGENTS.md` as navigation map only (no workflow checklists).
- Slim `agent-workflow.mdc` to a pointer at config; keep other rules as short product invariants.
- Distilled skills: `react-composition`, `react-perf-spa`, `ui-review`.
- `openspec-design-reviewer` subagent; strengthen proposal/implementation reviewers.
- Deterministic security: `pnpm audit:ci` in checks + CodeQL workflow.

## Scope out

- Product/runtime UI or photo-card behavior changes.
- Full Vercel/samber skill packs or `.agents/skills/` migration.
- Full DESIGN.md design-token system.
- Non-CI security products (Snyk, etc.).
- `agent:*` shell wrappers / task-state handoff files.

## Success criteria

- Propose/apply/archive instructions from OpenSpec include the new mandates; `AGENTS.md` and alwaysApply rules contain no per-change checklist duplication.
- Archive guidance forbids skip-sync when delta specs exist.
- Three thin skills exist under `.cursor/skills/` and design-reviewer agent file exists.
- `pnpm audit:ci` runs in `checks` workflow; CodeQL workflow present for JS/TS.
- `AGENTS.md` ≤150 lines and maps `src/*` → `openspec/specs/*`.

## Risks

- Config vs Cursor rules still duplicated if slim incomplete — mitigate by deleting workflow prose from rules.
- `audit:ci` / CodeQL may fail on existing transitive deps — triage and pin/override or document accepted findings before merge.
- Distilled skills may over-trigger — keep descriptions SPA-scoped and thin.
