# Tasks

## 1. Planning review consolidation

- [x] 1.1 Add `.cursor/agents/openspec-planning-reviewer.md` with full proposal + design checklists (docs-only skips design section); turn proposal/design agent files into one-line redirects
- [x] 1.2 Update `openspec/config.yaml` and `.cursor/commands/next-roadmap-item.md` for one planning review after proposal+design+tasks(+specs), ≤1 delta re-review, brief via `--out`, drop mandatory separate proposal/design launches; adjust Verification checklist wording

## 2. Run card and stats CLI

- [x] 2.1 Extend `scripts/agent.mjs`: preflight run card (per ready artifact template/rules + ≤10-line apply/archive procedure); `instructions <artifact>`; `review-brief --out <file>`
- [x] 2.2 Add `pnpm agent stats <path>` (JSON/JSONL/SQLite `agentStats.rounds`); print per-round metrics; exit 1 on peak context >300K or first-round input >400K; invalid → non-zero
- [x] 2.3 Tests in `scripts/agent.test.mjs` for run card / instructions / `--out` / stats (including fixture peak >300K → exit 1)

## 3. Docs and denies

- [x] 3.1 Update `AGENTS.md` exploration defaults + agent command list (stay ≤150 lines)
- [x] 3.2 Add `.cursor/cli.json` deny-only patterns last: `Shell(openspec:instructions*)`, `Read(openspec/config.yaml)`, `Read(.cursor/skills/openspec-*/**)`, `Read(.cursor/agents/**)`

## 4. Roadmap item ticks

- [x] 4.1 Tick Scope checkboxes in `docs/roadmap/M2.1/agent-cost-cuts.md` that this PR delivers; leave Done-when scratch-run unticked with note "scratch run + input-token comparison done by the reviewer on the owner machine"

## Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A non-UI
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A non-UI
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A non-UI
- [x] Docs/rules sync: AGENTS.md + next-roadmap-item + agents + config updated; roadmap item annotated (scratch Done-when left for owner reviewer)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced; this session Task schema lacked the new agent type — pass via generalPurpose standing in with the planning-reviewer checklist; agent file ships for future runs)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): N/A non-UI — see Manual test scenarios
- [x] Security Review: N/A (not security-tagged; no app security surface)

## Manual test scenarios

N/A — non-UI pipeline/rules change.
