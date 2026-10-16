# Tasks

## 1. Schema and migration

- [x] 1.1 Bump `CURRENT_SCHEMA_VERSION` to 2 and define optional asset-record fields (`sourceRootId`, `relativePath`, `byteSize`, `mtimeMs`, `contentHash`) on `assetSchema`; export `Asset` — verify typecheck and parse accepts empty `{}` and a full valid record
- [x] 1.2 Implement pure v1→v2 migration (set version 2; each asset → `{}`; preserve non-asset fields) — verify `migrateToCurrent` / `parseBook` tests for v1 empty assets and no invented identity fields
- [x] 1.3 Add parse rejection cases for negative `byteSize` and empty-string `sourceRootId` / `relativePath` / `contentHash` — verify unit tests fail parse as specified

## 2. Fixtures, ops, docs

- [x] 2.1 Keep shared fixtures on `CURRENT_SCHEMA_VERSION` with empty asset records; confirm `addToGallery` still inserts `{}` — verify existing ops/PBT suites and round-trip still pass
- [x] 2.2 Update `.cursor/rules/data-model.mdc` for v2 asset-record fields — verify the rule matches the shipped schema

## 3. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — green under `CI=true` (workers=1, retries=2); unrelated UI specs flaky locally without retries
- [x] pnpm stryker:diff — 93.75% (75 killed / 5 survived equivalent: migrate missing-`schemaVersion` key gate ≡ property read; `typeof === 'number'` ≡ `Number.isFinite`; Zod issue `code`/`path` not surfaced on `parseBook` public result beyond `message`)
- [x] pnpm test:coverage — migrate/schema asset-record paths covered; remaining schema lines 90–95 are gallery-duplicate issue details (message asserted; code/path equivalent)
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no UI / no bundle entry)
- [x] UI in scope: browser smoke evidenced … — N/A (prep, no UI)
- [x] Docs/rules sync: `.cursor/rules/data-model.mdc` updated for v2 asset records; nested roadmap tick at archive
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no lockfile/security surface)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: f8148ea9)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: 93eb6eb4 pass; low findings addressed or accepted)
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI [prep]; spec scenarios locked by unit tests (see Manual test scenarios)
- [x] High-risk security surface: Cursor Security Review subagent before archive — N/A (no FSA/workers/CSP/deps in this change)

## Manual test scenarios

N/A — [prep] with no UI. Spec scenarios locked by `src/core/migrate.test.ts` and `src/core/parse.test.ts`:

1. Empty `{}` and full asset records parse — observed via parse tests.
2. v1→v2 migrate leaves identity fields unset — observed via migrate + parse tests.
3. Negative / non-integer `byteSize`, NaN `mtimeMs`, empty-string identity fields rejected — observed via parse `it.each`.
4. Non-object v1 `assets` become `{}` — observed via migrate `it.each`.
