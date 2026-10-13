## Context

See proposal.md. Workflow mandates are split between `.cursor/rules/agent-workflow.mdc` and `openspec/config.yaml`. No root `AGENTS.md`. Archive may skip sync. No `audit:ci` / CodeQL.

## Goals / Non-Goals

- **Goals:** Config SoT; map-only `AGENTS.md`; design-reviewer; three thin skills; audit+CodeQL; always-sync archive; conditional Security Review for high-risk.
- **Non-Goals:** Runtime app changes; full public skill packs; wholesale rewrite of OpenSpec CLI skills.

## Decisions

1. **Config as SoT** — Put all per-change mandates in `openspec/config.yaml` `rules.proposal|design|tasks` and `operations.apply|archive.guidance`. Slim `agent-workflow.mdc` to one pointer line.
2. **Reviewer hooks** — `rules.proposal` → proposal-reviewer; `rules.design` → design-reviewer before tasks/apply; `rules.tasks` + `operations.apply` → implementation-reviewer; high-risk → Security Review before archive. Strengthen proposal-reviewer (UI success criteria / security risks) and implementation-reviewer (agent-docs evidence, design-reviewer evidenced, audit when deps change).
3. **architecture.mdc** — Add two bullets: capability folders under `src/<capability>/`; prefer composition over growing god components. No workflow checklist.
4. **AGENTS.md map-only** — Modules, commands, security surface, skill pointers; ≤150 lines; no pipeline checklist.
5. **Distill skills** — Thin SPA-only `react-composition`, `react-perf-spa`, `ui-review` under `.cursor/skills/`.
6. **Archive always sync** — `operations.archive.guidance` forbids skip-sync when deltas exist.
7. **Security CI** — `pnpm audit:ci` (`audit --audit-level=high`) in checks; CodeQL `javascript-typescript` workflow.

## Touch-set

- `openspec/config.yaml`
- `openspec/changes/agent-context-pipeline/**`
- `AGENTS.md`
- `.cursor/rules/agent-workflow.mdc`, `.cursor/rules/architecture.mdc`
- `.cursor/agents/openspec-design-reviewer.md`, `openspec-proposal-reviewer.md`, `openspec-implementation-reviewer.md`
- `.cursor/skills/{react-composition,react-perf-spa,ui-review}/SKILL.md`
- `package.json`
- `.github/workflows/checks.yml`, `.github/workflows/codeql.yml`

## Composition

Config owns mandates; agents/skills consume them. Skills on-demand only.

## Security

- Deterministic: audit:ci + CodeQL.
- Config conditional Security Review for FS/workers/blob/CSP/deps/export.
- Workers assets-only unchanged.

## Risks / Trade-offs

- [Audit fails CI] → Triage before merge.
- [Archive skill still prompts skip] → Project guidance forbids accepting skip when deltas exist.
- [AGENTS.md growth] → 150-line cap + agent-docs task item.

## Migration

Branch `feat/agent-context-pipeline`. After verify+reviews, archive with mandatory sync of `agent-context` into `openspec/specs/`.
