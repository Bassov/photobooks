# Tasks

## 1. Schema and migration

- [x] 1.1 Bump `CURRENT_SCHEMA_VERSION` to 3; add optional book `title` and asset metadata fields (`widthPx`/`heightPx`, `orientation`, `capturedAt`, `colorSpace`, `iccProfileName`, `mime`, optional `meta`) in `src/core/schema.ts`; fixtures support optional `title` override (omit when unset)
- [x] 1.2 Add pure `migrateV2ToV3` (title default `""`, no invented metadata) and chain it after v1→v2 in `migrate.ts`
- [x] 1.3 Table-driven schema + migration + parse tests covering accept/reject and v1/v2→3 chains; target mutation ≥85% (0 NoCoverage) and patch ≥85% on schema/migration

## 2. BookSummary and docs

- [x] 2.1 Extend `BookSummary` with `title`; memory + FSA `listBooks` return document titles via existing worker-backed `loadBookText` (no main-thread parse for listing; failed parse → `title: ""`); update project tests
- [x] 2.2 Sync `.cursor/rules/data-model.mdc` and tick roadmap Scope boxes when delivered

## 3. Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface

### Equivalent mutants (stryker:diff)

- `migrate.ts` missing-`schemaVersion` early return vs fallthrough (`readSchemaVersion` still yields `undefined`)
- `bookTitle.ts` missing-`title` early return vs fallthrough (`typeof raw.title === 'string'` is false)
- `fsaLibraryStorage.ts` `listBooks` `text === undefined` branch vs continuing into `loadBookText` soft-fail (both yield `{ id, title: "" }`)
- `fsaLibraryStorage.ts` `createBook` `{ rotateBak: false }` → `true` / `{}` when no prior `book.json` (rotate no-ops)
- Pre-existing `isLibraryDirectoryHandle` AND/OR / always-true guards on untouched handle-detection lines in the same file

Observed local `pnpm stryker:diff`: mutation score ~95% of non-ignored mutants, **0 NoCoverage**.

## Manual test scenarios

(N/A — schema/migration prep; no UI. Spec scenarios exercised by unit tests.)
