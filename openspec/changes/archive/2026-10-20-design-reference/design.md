## Decisions

1. Single SoT `docs/design.md`: principles, Theme B type/spacing/radius/elevation/z/motion + semantic roles, component inventory (variants + required states + empty/loading/error), migration audit (kit wins; gaps listed). Each primitive/pattern names its kit screen (`uikit#/feature/…` or Components SPECS id → DOM `c-<id>`).
2. No `src/` styling this change — audit is the M2.5 migration checklist only.
3. Agent wiring: `openspec/config.yaml` UI mandate (use tokens/primitives from `docs/design.md`; new ones added in the same change); `ui-review` design-system gate; planning-reviewer fails UI OpenSpec design that omits named tokens/primitives; `.cursor/rules/design.mdc` (globs `src/**/*.{css,tsx}`, not alwaysApply) points to `docs/design.md`; `AGENTS.md` map row; register `design.mdc` in `quality/gates.json` `agentRules.budgets`.
4. `skip_specs: true` (`.skip-specs`).

## Touch-set & Test Plan

- Files: `docs/design.md`; `openspec/config.yaml`; `.cursor/skills/ui-review/SKILL.md`; `.cursor/agents/openspec-planning-reviewer.md`; `.cursor/rules/design.mdc`; `AGENTS.md`; `quality/gates.json` (design.mdc budget); roadmap item (+ **Done when** assumption).
- Reuse: kit Theme B (`uikit/src/index.css`), Components page, M2.5 feature notes in `uikit/src/features/m25.tsx`.
- Tests: N/A unit/e2e (docs/rules). Manual: doc↔kit alignment smoke; `pnpm check` (rule budgets). Skill `ui-review` for design-system gate wording before archive.
