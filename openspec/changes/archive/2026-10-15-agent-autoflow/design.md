## Context

See proposal. Mandates live in `openspec/config.yaml`; finish/PR in `git-finish.mdc`. CLI-generated `opsx-*` / `openspec-*` stay untouched — planning uses OpenSpec CLI directly.

## Goals / Non-Goals

- Goals: wire unattended stages; codify Manual check + Docs/rules sync + archive tick; PR/CI wait; #49 drift cleanup; Perf/Browser backfill on three shipped features.
- Non-goals: product code; security-reviewer agent; forking OpenSpec CLI files.

## Decisions

1. **Orchestrator command only** — `.cursor/commands/next-roadmap-item.md` answers archive prompts ("Sync now") and picks the item; does not duplicate config checklists.
2. **Security stop-and-ask** — keep config Security Review item for explicit high-risk apply; unattended flow stops on security-tagged items.
3. **UI checks split** — automated UI smoke stays in apply before impl review; Manual check (browser Browser check) after review pass, before archive.
4. **Mutation triage before review** — local `stryker:diff` + `test:coverage`; CI step is wait-for-green / fix-red only.
5. **Roadmap tick in PR** — match practice: tick right after archive on the feature branch.
6. **Perf/Browser backfill** — add `**Perf:**` and `**Browser check:**` under shipped items `filmstrip-file-name`, `template-unplace-notice`, `add-spread-camera` (roadmap lines ~115–118), matching what shipped.
7. **#49 drift (concrete)** — `testing.mdc` verify:fast description (+ deps/knip/mutation-scope); README design-reviewer + workflow with manual check + one CI report comment + mutation-scope in scripts table; remove stale `core-is-pure` / `data-model.mdc` notes from `docs/future-architecture.md`; annotate M1 asset worker pool (folder scan on main thread; off-screen jobs not aborted).
8. **config.yaml mandate shape** —
   - `rules.proposal`: roadmap `[feature]` success criteria MUST cover Browser check + Perf (write into roadmap if missing).
   - `rules.tasks`: after `tasks.md`, `openspec validate <change> --strict`.
   - Verification checklist: replace Agent docs with Docs/rules sync; list Manual check after the implementation-reviewer item (run after that pass).
   - `operations.apply`: stryker:diff + test:coverage triage; after impl review pass → Manual check; Manual test scenarios feed the PR.
   - `operations.archive`: require Manual check + Docs/rules sync checked; drift grep; after move tick roadmap box.
   - Lessons: `[repeat]` append; `[lesson]` sharpen existing line.

## Security

Docs/agent-pipeline only. Security Review N/A for this change. Unattended runs stop-and-ask on security-tagged roadmap items.

## Touch-set

- `.cursor/commands/next-roadmap-item.md` (new)
- `openspec/config.yaml`
- `.cursor/agents/openspec-implementation-reviewer.md`
- `.cursor/agents/openspec-design-reviewer.md` (Inputs: also `tasks.md`)
- `.cursor/rules/git-finish.mdc`
- `.cursor/rules/testing.mdc`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/roadmap.md`, `docs/future-architecture.md`
- `README.md`, `AGENTS.md`
- `openspec/specs/agent-context/spec.md` (via archive sync)

## Composition / boundaries

Docs and agent pipeline only. No `src/` modules. Public contract is the mandate text and command (spec scenarios); no product unit suite — `openspec validate --strict` + `pnpm verify:fast`.

## Risks / Trade-offs

- [Agent still stops after planning] → explicit e2e authorization in the command; never call `/opsx-propose`.
- [Parallel dirty main specs] → one roadmap item at a time.
- [Security gap until M2] → stop-and-ask; first hit `library-storage-fsa`.
