# Proposal

## Problem

Roadmap checkboxes bundle several independent subsystems into one change. `editor-shell-filmstrip` shipped a worker pool, pickers, an object-URL LRU, a store, the UI, the photo-card removal and new e2e/perf scenarios in one PR (+2698 / −822, 48 files), exhausted the agent context once, and still needed eight follow-up PRs of UI polish. Most remaining `[feature]` items have the same shape.

## Why now

The three unstarted M1 items (painter, camera, drag-and-drop) each stack a new subsystem on the in-flight filmstrip. Re-slicing before the next apply is cheaper than re-learning it per PR.

## Scope in

- Size budget for one change: one new subsystem, at most 8 implementation tasks; guideline: ~1000 changed lines of source and tests
- Slicing rules in `docs/roadmap.md` "How to use": a definition of "subsystem" with examples, infra in `[prep]` before a thin `[feature]`, schema bumps in their own `[prep]`, risk gates and fallbacks as explicit contingency items
- Mandates in `openspec/config.yaml` (and the proposal reviewer's narrowness check): proposals over budget narrow scope and add the remainder to the roadmap as new checkboxes before apply
- Re-slice unchecked roadmap items M1–M7 that exceed the budget; drop the duplicated OPFS-thumbnail bullet; add an M8 re-plan note
- Update change-name references in `docs/future-architecture.md` that the re-slice renames
- `agent-context` spec: change-sizing requirement

## Scope out

- Runtime, CI, or test code
- `editor-shell-filmstrip` (in flight, PR #19): neither re-sliced nor ticked
- Re-slicing M8 (re-planned at the M7 review cut)
- Changing product scope, order, or architecture decisions (reference renames only)

## Success criteria

- Every unchecked top-level roadmap item outside `editor-shell-filmstrip` and M8 names at most one new subsystem; former nested scope is preserved, only moved
- `docs/roadmap.md` "How to use" defines a subsystem with examples, lists the slicing rules, and points to the config budget
- `openspec instructions proposal` and `openspec instructions tasks` output include the size budget and the split-before-apply rule
- Every roadmap change name referenced in `docs/future-architecture.md` exists in `docs/roadmap.md`
- `agent-context` main spec contains the change-sizing requirement after archive
- `pnpm verify:fast` green

## Risks

- Lost scope while moving bullets → diff old vs new nested bullets item by item during apply
- Over-slicing raises fixed per-change overhead (reviewers, artifacts) → budget is "one subsystem", not "one task"; trivial items stay merged
- Line budget is a heuristic → stated as a guideline; subsystem and task-count rules are the enforceable part

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `agent-context`: add change-sizing budget and split-before-apply rule

## Impact

`docs/roadmap.md`, `docs/future-architecture.md` (references only), `openspec/config.yaml` rules, `.cursor/agents/openspec-proposal-reviewer.md`, `openspec/specs/agent-context/`. No application or CI runtime change.
