# codecov-project-components

Tag: prep
Milestone: M2.1
Title: Codecov project no-drop status and components table

## Scope

- [ ] `codecov/project` no-drop status: `project.default` `target: auto`, `threshold: 0.5%`, plus `project.floor` at 80% so the absolute floor never disappears — posted as a GitHub check context the owner can require on `main`
- [ ] Codecov PR comment components table for `editor`, `project`, `assets`, `render`, `core`, and `scripts` (alongside existing `photo` / `perf` / `lib`)
- **Done when:** a PR that drops project coverage by more than 0.5% gets a red `codecov/project` (or named `codecov/project/*`) GitHub status, and the Codecov PR comment shows the `editor`, `project`, `assets`, `render`, `core`, and `scripts` components.
- **Size:** ~100 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 A; owner decision 2026-10-18 from `codecov-patch-gate`
- **Reason:** Codecov does not post `codecov/project` or the components table on this repo (verified on all PRs #100–#105). Owner decision 2026-10-18: keep YAML keys (valid, harmless) but do not treat posting/enforcement as part of `codecov-patch-gate`.
