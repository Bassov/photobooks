# Design

## Context

See proposal.md — Why. Today `codecov.yml` has informational patch, project `target: 80%` / `threshold: 1%`, and Components only for photo/perf/lib. Vitest CI floor stays 80%. No workflow job moves.

## Goals / Non-Goals

**Goals:** Strict Codecov statuses + Components; delta + INTRO owner note; Done-when proven from real Codecov on this PR head (and scratch red PR if needed).

**Non-Goals:** Vitest threshold edits; ignore/exclude list; e2e upload (`e2e-coverage-flag`); agent-changed branch protection; `test-fake` un-counting; app/src behavior.

## Decisions

1. **Dual project statuses** — `project.default`: `target: auto`, `threshold: 0.5%` (stricter than 1%). `project.floor`: `target: 80%`, `threshold: 0%` so the absolute floor never disappears when default becomes relative. Alternative rejected: only `auto` (loses fixed 80% status) or only raise threshold on fixed 80% (does not encode no-drop).
2. **Blocking patch on default only** — `patch.default`: `target: 85%`, `threshold: 0%`, omit `informational`. Do not add a separate informational unit-only patch status. Flags list stays as-is (`unit`); when `e2e` uploads later, patch merges flags without YAML change here.
3. **Components additive** — Append `editor`, `project`, `assets`, `render`, `core`, `scripts` with the item's path globs; keep photo/perf/lib and `comment.layout` including `components`.
4. **Owner required checks** — Record in `INTRO.md` only: add `codecov/patch` and `codecov/project` (plus named `codecov/project/*` if Codecov emits them for `default`/`floor`). Agents never edit GitHub settings.
5. **Done-when evidence** — Validate YAML via Codecov validate API. Green path: this PR's `codecov/patch`, project status(es), and comment component table. Red path: draft `scratch/codecov-red-*` PR(s) that demonstrate failing patch (<85%) and failing project drop (>0.5%); close + delete each scratch branch; cite status URLs in tasks/PR. If a red case cannot be observed after a real attempt, do not tick Done-when — record the exact missing case and BLOCKED (permission/tooling) instead of treating absence as success.

## Risks / Trade-offs

- [Named project statuses] → GitHub may show `codecov/project/default` and `codecov/project/floor`; INTRO notes owner must require the contexts Codecov actually posts.
- [Red proof needs deliberate bad coverage] → scratch PR only; never leave it open or weaken production ignore lists.

## Touch-set

| Path                                          | Reason                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `codecov.yml`                                 | Gate tighten: blocking patch 85%, project auto/0.5% + floor 80%, new Components |
| `openspec/specs/ci-gates/spec.md` (via delta) | Spec SoT for Codecov thresholds/components                                      |
| `docs/roadmap/M2.1/INTRO.md`                  | Owner required-check note for codecov statuses                                  |
| `openspec/changes/codecov-patch-gate/**`      | Planning artifacts                                                              |
| `docs/roadmap/M2.1/codecov-patch-gate.md`     | Scope ticks / Status via roadmap CLI                                            |

## Migration

Ship on feature branch; after merge owner adds required checks. Rollback: revert `codecov.yml` (would weaken gates — avoid unless emergency).

## Open Questions

None.
