# Proposal

## Problem

Unattended `/next-roadmap-item` first rounds burn ~230K input tokens by re-reading OpenSpec rules/skills/agents and by running two planning reviewers, so sessions risk exceeding 300K context.

## Why now

Owner cost analysis (2026-10-18) ranks cuts 3–6 and 8 as top priority before more product work.

## Scope in

- One OpenSpec planning review after proposal + design + tasks (implementation review stays; ≤1 delta re-review; docs-only skips design review).
- Compact preflight run card + on-demand artifact instructions so agents stop raw-reading denied OpenSpec/agent files.
- Exploration defaults: scoped grep ≤30, offset/limit for large files, no re-read, no TodoWrite in unattended `-p`.
- `pnpm agent stats` with peak >300K / first-round >400K exit 1; fixture test covers failure.

## Scope out

- Gate-values / check / vite / playwright / Stryker / LHCI / quality / lessons (other session); codecov.yml (other PR).
- Nested scratch `/next-roadmap-item` token comparison (reviewer on owner machine).
- App UI; new dependencies; package.json scripts unless `stats` needs one.

## Success criteria

- Planning uses one OpenSpec review after all planning artifacts; implementation review unchanged.
- Run card / `agent instructions` cover templates and rules so denied raw reads of config/skills/agents/`openspec instructions` are unused.
- `pnpm agent stats` prints per-round metrics and exits 1 on a >300K fixture.
- Scratch-run input-token comparison vs ~230K pre-change average: reviewer reports on PR head (not claimed here).

## Risks

- Over-broad cli.json denies could block legitimate reads — add only the listed deny patterns, never weaken existing ones.
- Merged planning reviewer must retain both proposal and design checklists or quality regresses.
