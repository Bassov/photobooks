# Tasks

## 1. Agent CLI

- [x] 1.1 Add `scripts/agent.mjs` (`preflight`, `finish`, `review-brief`; `--json`/`--quiet`/`--root`; injectable `exec`) and `"agent"` in `package.json` — verified: `pnpm agent help` exits 0
- [x] 1.2 Add `scripts/agent.test.mjs` (fake-exec harness; cases from design Tests) — verified: `pnpm exec vitest run scripts/agent.test.mjs` 8 passed

## 2. Wire docs and command

- [x] 2.1 Rewrite `.cursor/commands/next-roadmap-item.md` steps 1–2 and 6 to `pnpm agent preflight` / `finish`; add batching + `review-brief` — verified phrases present
- [x] 2.2 Update `AGENTS.md` (≤150 lines): `pnpm agent` in Commands; MCP minimal surface in Toolchain — verified `wc -l` = 83; MCP wording present

## 3. Spec and roadmap ticks

- [x] 3.1 Keep delta `specs/agent-context/spec.md` aligned; `openspec validate agent-pipeline-fewer-calls --strict` green
- [x] 3.2 Tick scope checkboxes in `docs/roadmap/M2.1/agent-pipeline-fewer-calls.md` as work lands

## Verification

- [x] pnpm typecheck — green via `pnpm verify:fast:quiet`
- [x] pnpm lint — green via `pnpm verify:fast:quiet`
- [x] pnpm test — green via `pnpm verify:fast:quiet` (85 files / 784 tests)
- [x] pnpm test:e2e (or pnpm verify) — `pnpm test:e2e:quiet`: 55 passed; intermittent failures on unmodified-main-class flakes filed into `e2e-local-flakes` (autosave, drag-swap escape, spread-view LoAF); pre-push remains `verify:fast`; Playwright stays CI gate
- [x] pnpm stryker:diff — No mutable src files changed vs origin/main; skipping Stryker
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (non-UI)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A (non-UI prep)
- [x] Docs/rules sync: AGENTS.md Commands + MCP; next-roadmap-item wired; roadmap items added; future-architecture unchanged; README unchanged (no Lefthook change)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (script entry only; lockfile unchanged)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — pass
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass (mediums fixed: Finish scenarios + AGENTS module map; e2e-local-flakes called out as out-of-scope filing)
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI prep — recorded under Manual test scenarios
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — N/A (docs/scripts; not security-tagged)

## Manual test scenarios

1. `pnpm agent help` — prints usage for preflight/finish/review-brief (exit 0).
2. `pnpm exec vitest run scripts/agent.test.mjs` — 8 passed.
3. `pnpm -s agent review-brief --change agent-pipeline-fewer-calls --rules-json '[]'` — prints slug, changePath, diff --stat, touch-set paths from design.md.
4. `wc -l AGENTS.md` — 83 (≤150); Commands includes `pnpm agent`; Toolchain documents minimal MCP surface.
