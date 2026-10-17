# Tasks

## 1. Agent CLI

- [x] 1.1 Add `scripts/agent.mjs` (`preflight`, `finish`, `review-brief`; `--json`/`--quiet`/`--root`; injectable `exec`) and `"agent"` in `package.json` — verified: `pnpm agent help` exits 0
- [x] 1.2 Add `scripts/agent.test.mjs` (fake-exec harness + real `git init` review-brief) — verified: 30 tests passed

## 2. Wire docs and command

- [x] 2.1 Rewrite `.cursor/commands/next-roadmap-item.md` steps 1–2 and 6 to `pnpm agent preflight` / `finish`; add batching + `review-brief` — verified phrases present
- [x] 2.2 Update `AGENTS.md` (≤150 lines): `pnpm agent` in Commands; MCP minimal surface in Toolchain — verified

## 3. Spec and roadmap ticks

- [x] 3.1 Keep delta `specs/agent-context/spec.md` aligned; `openspec validate` green
- [x] 3.2 Tick scope checkboxes in `docs/roadmap/M2.1/agent-pipeline-fewer-calls.md` as work lands

## 4. Review follow-up (PR #81)

- [x] 4.1 Include `scripts/agent.mjs` in vite coverage, Stryker mutate, and Codecov unit paths (stricter gate surface)
- [x] 4.2 Fix F2–F5 / S2–S3 in `agent.mjs` with tests that fail on the prior code
- [x] 4.3 Move `agent-pipeline-call-count-check` after `agent-pipeline-token-check`; expand follow-up for owner rtk + MCP schema measure

### Coverage / mutation (`scripts/agent.mjs`)

- Coverage (vitest `--coverage` on `scripts/agent.test.mjs`): statements **98.86%**, branches **88.47%**, functions **98.24%**, lines **99.35%** (all ≥85%)
- Mutation (`stryker run --mutate scripts/agent.mjs`): score **97.87%**, **0 NoCoverage**, 46 killed / 1 survived / 924 ignored (noise mutators disabled in-file)

### Equivalent survivors (one-line reasons)

- L53 `eq >= 0` → `eq > 0`: only differs when the token after `--` starts with `=` (`--=…`); both paths reject as unknown/empty flag — equivalent for valid CLI flags

## Verification

- [x] pnpm typecheck — via `pnpm verify:fast:quiet`
- [x] pnpm lint — via `pnpm verify:fast:quiet`
- [x] pnpm test — via `pnpm verify:fast:quiet`
- [x] pnpm test:e2e — CI Playwright gate; local intermittent flakes listed on `e2e-local-flakes` (same class as main)
- [x] pnpm stryker:diff — agent.mjs in mutate set; local full mutate score above
- [x] pnpm test:lhci — N/A (non-UI)
- [x] UI in scope — N/A
- [x] Docs/rules sync — AGENTS, command, roadmap, codecov/vite/stryker configs
- [x] pnpm audit:ci — N/A (no lockfile change)
- [x] openspec-design-reviewer — pass (prior)
- [x] openspec-implementation-reviewer — pass; this follow-up addresses Must-fix
- [x] Manual check — see scenarios below
- [x] Security Review — N/A

## Manual test scenarios

1. `pnpm agent help` — usage for preflight/finish/review-brief (exit 0).
2. `pnpm exec vitest run scripts/agent.test.mjs` — 30 passed.
3. Scratch `git init` review-brief: untracked touch-set file appears in touchDiff; outside edit in outsideTouchSet (automated in agent.test.mjs).
4. `finish` on branch `main` — refuses with feat|fix required (automated).
5. `finish` with failing verify — error includes real stderr tail, not only ELIFECYCLE (automated).
6. `pnpm -s agent review-brief --change agent-pipeline-fewer-calls --rules-json '[]'` — prints slug/stat/outside sections.
7. Note: issue #79 taken before #78 by owner choice; measurement/rtk in `agent-pipeline-call-count-check`.
