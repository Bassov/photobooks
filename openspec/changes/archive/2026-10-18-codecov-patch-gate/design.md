# Design

## Context

See proposal.md — Why. Today `codecov.yml` had informational patch, project `target: 80%` / `threshold: 1%`, and Components only for photo/perf/lib. Vitest CI floor stays 80%. No workflow job moves.

Owner decision 2026-10-18: Codecov does not post `codecov/project` or the components table on this repo (verified on PRs #100–#105). Item Done-when narrows to blocking `codecov/patch` at 85%. Project no-drop and components table moved to `docs/backlog/codecov-project-components.md`. YAML project.* and expanded Components keys stay (valid, harmless).

## Goals / Non-Goals

**Goals:** Blocking Codecov `codecov/patch` at 85%; delta + INTRO owner note for that check only; Done-when proven red on scratch #105 and green on #104.

**Non-Goals:** Enforcing `codecov/project` or the components table in this PR (backlog); Vitest threshold edits; ignore/exclude list; e2e upload (`e2e-coverage-flag`); agent-changed branch protection; `test-fake` un-counting; app/src behavior.

## Decisions

1. **Blocking patch on default only** — `patch.default`: `target: 85%`, `threshold: 0%`, omit `informational`. Do not add a separate informational unit-only patch status. Flags list stays as-is (`unit`); when `e2e` uploads later, patch merges flags without YAML change here.
2. **YAML keeps project + Components** — Retain `project.default` (`auto` / 0.5%), `project.floor` (80%), and Components `editor`/`project`/`assets`/`render`/`core`/`scripts` in `codecov.yml` as valid harmless config. Do not require GitHub checks Codecov never posts. Enforcement of project status and comment table is backlog.
3. **Owner required check** — Record in `INTRO.md` only: add `codecov/patch` on `main`. Agents never edit GitHub settings. Do not list `codecov/project` as required (a never-posted required check would block every PR).
4. **Done-when evidence** — Validate YAML via Codecov validate API. Green: PR #104 `codecov/patch` pass. Red: scratch PR #105 `codecov/patch` fail (patch 0%).

## Risks / Trade-offs

- [Project/components not gated here] → tracked in backlog until Codecov posts them; YAML already prepared.
- [Red proof needs deliberate bad coverage] → scratch PR only; never leave it open or weaken production ignore lists.

## Touch-set

| Path                                          | Reason                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `codecov.yml`                                 | Gate tighten: blocking patch 85%; project/Components keys retained (harmless) |
| `openspec/specs/ci-gates/spec.md` (via delta) | Spec SoT for enforced Codecov patch 85%                                       |
| `docs/roadmap/M2.1/INTRO.md`                  | Owner required-check note for `codecov/patch` only                            |
| `docs/backlog/codecov-project-components.md`  | Deferred project status + components table                                    |
| `openspec/changes/codecov-patch-gate/**`      | Planning artifacts                                                            |
| `docs/roadmap/M2.1/codecov-patch-gate.md`     | Narrowed Done-when / Scope via owner decision                                 |

## Migration

Ship on feature branch; after merge owner adds required `codecov/patch`. Rollback: revert `codecov.yml` (would weaken gates — avoid unless emergency).

## Open Questions

None.
