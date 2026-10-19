# Proposal

## Why

**Problem:** The agent findings journal (`docs/lessons.md` / `docs/lessons/`) is mandated reading before every apply and grows on every `[repeat]` finding. It duplicates the quality bar, area specs, and existing checks, and drifts across PRs.

**Why now:** Owner priority (2026-10-19): lessons and rules must stop growing. Issue #78 / roadmap `lessons-dissolve`.

## What Changes

- Remove the journal; replace “append a lesson” with repeat finding → automated check (else area SHALL / code comment).
- Migrate the 24 lines (journal 01–24): delete verified duplicates; gate lines point at named mechanical owners only; remaining gotchas live in named specs/checks. Dissolve extras 25–29 + dated the same way.
- Update config, `agent-context`, AGENTS, future-architecture, implementation reviewer, live roadmap wording, agent merge helpers.
- Owner-requested follow-up (not implemented): `rules-dedup` after this item.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `agent-context`: repeat-finding → check; drop journal requirements and lessons wording from non-weaken / merge rules.
- `preview-hosting`: Workers Builds pin Node via `.nvmrc`, not asdf.
- `editor-shell`: import FileList, open-adopt, filmstrip packing/window/empty/reveal/pacing SHALLs where missing.
- `derived-cache`: encode-after-hash puts awaited via pending-hash tracking.
- `asset-source`: visibility MUST NOT abort off-screen import jobs.
- `spread-view`: drag source stays mounted through drop.
- `frame-budget`: no 200 ms LoAF allowance.

## Impact

**Scope in:** Journal deletion; mandate/doc/spec updates above; small named tests only for gaps; `rules-dedup` roadmap add; PR disposition table for 01–24 (+ extras note).

**Scope out:** Implementing `stryker-diff-gate` / `exclusions-registry` / gate scripts; `uikit-import*` rewrites; `package.json` deps; app feature work.

**Success criteria:** Journal paths gone; `rg -i lessons` clean outside archives and allowlist (`openspec/changes/lessons-dissolve/**` until archive; `docs/roadmap/M2.1/lessons-dissolve.md`; `docs/roadmap.md` index/goal lines that name this slug; `docs/roadmap/M2.1/INTRO.md` Phase-3 slug list); PR body lists each of the 24 dispositions; gates unchanged or stricter.

**Risks:** Spec-only gotchas depend on future area reads (accepted by #78 when a check is infeasible). Parallel open PRs may still mention the journal until they merge (out of scope). No security-surface change.
