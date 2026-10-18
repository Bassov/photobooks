# Proposal

## Problem

Agent loops duplicate the verify suite (finish then pre-push), drown in verbose check output, and juggle many check commands instead of one deterministic pass that surfaces every failure at once.

## Why now

Owner priority on this leftovers item: one `pnpm check` entry with minimal default output, shared by pre-push and CI, without weakening required gates (issues #77, #79; PR #81 leftovers).

## Scope in

- One deterministic local entry reports all independent check failures in a single run (e2e stays separate).
- Default check output is minimal (OK lines or capped problems; full detail only when requested or on disk).
- Pre-push and the required CI `checks` job use that same entry; every check that job required before still fails that job when it fails.
- `pnpm agent finish` triggers that entry once per push (never `--no-verify`).
- Preflight warns when a reused branch is behind `origin/main` and lists review-checklist ids when that file exists.
- Agent-facing docs/commands/tasks verification wording collapse to that one check command; compact instruction defaults where only template+rules are needed.
- Tests cover the check wrapper and agent changes at the `scripts/agent.mjs` bar.

## Scope out

- `finish` reading CI report JSON (`pr-metrics-autogen` item; left unticked).
- rtk wrappers (still deferred).
- App UI; new runtime dependencies.
- Softening or relocating any required CI gate.

## Success criteria

- Three different failures (lint, unit, roadmap) all appear in one `pnpm check`, each ≤ 20 lines; a green run prints ≤ 1 OK line per check.
- Happy-path finish runs the same deterministic entry once per push; never `--no-verify`.
- Preflight flags a stale-behind-main branch; checklist ids emit when the file exists.
- Docs/config/command name one check command; wrapper in coverage + mutation scope.
- Required CI `checks` still fails when any former required check fails.

## Risks

- Wiring CI/pre-push through one entry could drop or relocate a gate — mitigate with an explicit same-job inventory and tests.
- Parallel orchestration / log parsing mistakes — keep parsers deterministic; full logs always retained.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `agent-context`: unified check entry + compact output; finish single-run; preflight stale/checklist; compact instruction defaults; docs point at one command.
- `ci-gates`: pre-push and required `checks` call the same entry without weakening required steps.

## Size

Re-estimate ~1100–1400 LOC (was ~400 before check/output extension); hard max 1500; one new subsystem (check runner). Overflow → `pnpm roadmap add --after`.
