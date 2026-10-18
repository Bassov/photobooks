# Design

## Context

See proposal.md. Today `verify:fast` is a sequential `&&` chain; finish runs `verify:fast:quiet` then pre-push runs `verify:fast` again. CI `checks` lists the same tools as separate steps plus format/coverage/build/headers/audit. Agent output is still tool-default verbose.

## Goals / Non-Goals

**Goals:** one orchestrator (`pnpm check`) with fail-all + compact reporters; finish single-run via pre-push; preflight stale + checklist ids; docs point at `pnpm check`; CI/pre-push call it without weakening.

**Non-Goals:** pr-metrics-autogen CI JSON for finish; rtk; replacing integration/e2e/stryker/lhci jobs; inventing `quality/review-checklist.md` or pr-policy scripts (hook when files exist; owned by later items).

## Decisions

1. **Check runner (one new subsystem)** — `scripts/check.mjs` exports `runChecks(opts)` + CLI. Core inventory: typecheck, lint, deps, knip, mutation-scope, git-test-isolation, roadmap check, unit. **When applicable:** if `scripts/check-diff-size.mjs` / `scripts/check-pr-body.mjs` / a future `pr-policy` local entry exist, include them; otherwise skip (no stubs). Concurrent independent checks; aggregate exit. `"check": "node scripts/check.mjs"`; `verify:fast` / `verify:fast:quiet` → `pnpm check` (compact default; `--verbose` full).

2. **Compact output** — shared helper used by every inventory member inside `pnpm check` (writes `.cache/checks/<name>.log`; OK one-liner or ≤20 problem lines + log trailer). Standalone `test:quiet` / `test:e2e:changed:quiet` already quiet — keep; polish success to `OK …` only if cheap. Wrap `roadmap check` when invoked via check inventory; `stryker:diff` stays its own quiet CLI (not in pre-push inventory) unless LOC allows a one-line OK shim. Finish surfaces pre-push/`check` summary in the same compact shape. No rtk.

3. **Finish single-verify** — drop upfront `verify:fast:quiet` (incl. after trivial merge). Push with hooks; parse check failure from push output. Never `--no-verify`.

4. **CI wire** — Replace overlapping steps in `checks.yml` with `pnpm check --verbose --skip-unit`. Keep format:check, test:coverage, build, assert-dist-headers, audit:ci in the **same** required job (no `continue-on-error`). `test:coverage` already runs the same vitest projects as `unit`, so CI skips unit inside `pnpm check` to avoid a double suite; pre-push keeps full `pnpm check`.

5. **Preflight stale** — Roadmap “rebase-or-recreate” maps to project policy: **never rebase/force**. If reused branch is behind `origin/main`: warn; prefer recreate from `origin/main` when the branch has no unique commits vs the preflight base; otherwise `git merge origin/main` (same allowlist/fail rules as finish). Checklist ids from `quality/review-checklist.md` when present.

6. **Docs / compact instructions** — Point AGENTS, config quality bar, next-roadmap-item, tasks verification at `pnpm check`. Keep `{template,rules}` compact in preflight.

7. **Tests / mutation** — Public API under test: `runChecks` result `{ ok, results[] }` and CLI exit/stdout contract; `cmdFinish` push-once; `cmdPreflight` stale + ids. Reuse `scripts/git-test-helper.mjs` / `strip-git-env` (clear every `GIT_*`; tmp repos only). Add `scripts/check.mjs` to Stryker mutate. **No stub proofs:** fixtures drive real inventory wiring (multi-fail aggregation, entry aliases), not mocked always-green runners.

## Touch-set

- `scripts/check.mjs`, `scripts/check.test.mjs` (+ cli shim only if knip needs it)
- `scripts/agent.mjs`, `scripts/agent.test.mjs`
- `package.json` — reason: add `check`; alias verify:fast without dropping inventory
- `lefthook.yml` — reason: pre-push calls `pnpm check` (same inventory, fail-all)
- `.github/workflows/checks.yml` — reason: required job calls unified entry; prior extra gates stay in-job
- `stryker.config.json` — reason: mutate `scripts/check.mjs` (stricter; new gate code in scope)
- `openspec/config.yaml`, `AGENTS.md`, `.cursor/commands/next-roadmap-item.md`, `.cursor/rules/git-finish.mdc`
- `openspec/specs/agent-context/spec.md`, `openspec/specs/ci-gates/spec.md` (archive sync)
- `docs/roadmap/M2.1/agent-pipeline-leftovers.md` (ticks; pr-metrics unticked)
- `scripts/roadmap.mjs` only if compact defaults need code

## Risks / Trade-offs

- [CI double unit] → `--skip-unit` in CI `pnpm check`; coverage step owns the unit suite.
- [Parser fragility] → cap + log path; `--verbose` in CI.
- [Stale conflicts] → fail with file list; no blind keep-both.

## Migration

Aliases preserve `verify:fast`. Rollback: restore sequential scripts + workflow steps.

## Open Questions

None; pr-metrics deferred to its item.
