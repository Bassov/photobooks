# Tasks

## 1. Schema, migrate, parse, invariants

- [x] 1.1 Add `src/core/schema.ts` with Zod v1 book shape (settings, layout grid, guides, assets Record, unique gallery, spreads/frames/crop) and `CURRENT_SCHEMA_VERSION`; verify types export and a minimal fixture parses under Zod alone
- [x] 1.2 Add `src/core/migrate.ts` (reject newer schema; identity migrate for v1) and unit tests for newer-schema failure and current-version success
- [x] 1.3 Add `src/core/invariants.ts` for the four referential checks; unit tests for dangling frame, placed-not-in-gallery, gallery-missing-asset, duplicate gallery id
- [x] 1.4 Add `src/core/parse.ts` (`parseBook` / `serializeBook`) wiring migrate → Zod → invariants; shared fixtures in `src/core/testing/fixtures.ts`; unit + PBT lossless round-trip

## 2. Structural-sharing updates and purity

- [x] 2.1 Add `src/core/update.ts` (`updateSpread` / `updateFrame`) with tests that unrelated spreads keep identity and no-op preserves references
- [x] 2.2 Add `src/core/index.ts` public exports; verify knip does not flag them when tests import the public API
- [x] 2.3 Add dependency-cruiser `core-is-pure` (mirror `lib-is-pure`); verify `pnpm deps` passes and would fail on a React import from `src/core`

## 3. Docs and roadmap

- [x] 3.1 Update `.cursor/rules/data-model.mdc` to book → spreads → frames → gallery/assets (no pages/slots)
- [x] 3.2 Add `src/core` + `book-core` to `AGENTS.md` module map
- [x] 3.3 Tick nested `book-core-schema` checkboxes in `docs/roadmap.md` as each lands

## 4. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff — ~87%+ (threshold 60); src/core included in mutate set
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no UI/bundle change)
- [x] Agent docs: AGENTS.md module map + data-model.mdc updated
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no lockfile/security-surface change)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: a156b741)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: 8a6cdea1 pass)
- [x] High-risk security surface: Cursor Security Review subagent before archive — N/A (pure schema; no security surface)

## Workflow follow-up

- Archive the change after implementation review pass; sync delta specs into main `openspec/specs/`.
- Commit, push, open PR; tick top-level `book-core-schema` only after merge.
