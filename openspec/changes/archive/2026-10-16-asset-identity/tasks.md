# Tasks

## 1. book-core contentHash

- [x] 1.1 Tighten `contentHash` Zod to 64-char lowercase hex SHA-256; add parse accept/reject cases — verify `pnpm exec vitest run src/core/parse.test.ts` (and typecheck for schema)

## 2. Domain AssetSource + memory

- [x] 2.1 Add `src/assets/types.ts` + `createMemoryAssetSource` (register/scan/readForHash, typed results, adapter-local permission/corrupted seeds) and shared `runAssetSourceContract` — verify memory adapter passes the contract suite
- [x] 2.2 Export public surface from `src/assets/index.ts`; extend `.dependency-cruiser.cjs` so `src/core` cannot import `src/assets`; update `AGENTS.md` module map — verify `pnpm deps` and imports resolve

## 3. FSA adapter

- [x] 3.1 Add File System Access `createFsaAssetSource` with local binary-capable directory fake (no `assets` → `project` dependency); factory attaches root handle — verify FSA adapter passes the same contract suite

## 4. Worker hashing + pool priority

- [x] 4.1 Add `hash.worker` + generalize `assetPool` with job kind and `'hash'` priority; export `enqueueHash` — verify pool tests: visible/background run before hash
- [x] 4.2 Implement `shouldReuseContentHash`, `hashContent`, and `resolveContentHash` — verify unit tests for fast-path reuse and worker-produced 64-hex digests

## 5. Pure match

- [x] 5.1 Implement pure `matchAssets` (hash preferred, then root/path/size/mtime); cover hash-win, metadata fallback, unmatched — verify `pnpm exec vitest run src/assets/match.test.ts`

## 6. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — green under `CI=true` (workers=1, retries=2); unrelated UI specs flaky locally without retries
- [x] pnpm stryker:diff — 67.41% (≥ break 60; 480 killed / 4 timeout / 180 survived / 54 no-cov). Added public-API cases for hash fast-path field mismatches, one-to-one hash match, cross-root metadata reject, SHA-256 pad length. Remaining: `memoryDirectory` create:/TypeMismatch defensive paths unused by contract API; FSA `corrupted` scan catch / empty-path resolve equivalents; `matchAssets` short-circuit `||`/`&&` equivalents on incomplete records; `assetPool` decode-path / emit(false) / abort plumbing largely equivalent under existing suite (hash ordering covered); schema `""`/`[]` default literals outside contentHash regex
- [x] pnpm test:coverage — assets/hash/match/memory/fsa paths exercised; `hash.worker.ts` shell excluded from mutate (logic in hashDigest)
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no UI / no app bundle entry wiring)
- [x] UI in scope: browser smoke evidenced … — N/A (prep, no UI)
- [x] Docs/rules sync: `AGENTS.md` module map; `.dependency-cruiser.cjs` assets rules; `knip.json` entry; `stryker` excludes; `.cursor/rules/data-model.mdc` contentHash hex; nested roadmap tick at archive
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — security-tagged (FSA + workers); `pnpm audit:ci` clean (no known high+ prod vulns)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: 5b493dd4)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: 077837fd pass; high findings fixed then re-pass)
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI [prep]; spec scenarios locked by unit/contract tests (see Manual test scenarios)
- [x] High-risk security surface: Cursor Security Review subagent before archive (evidenced: c91ea5a9 — no medium+ findings)

## Manual test scenarios

N/A — [prep] with no UI. Spec scenarios locked by `src/assets/*.test.ts` and `src/core/parse.test.ts`:

1. Memory + FSA adapters pass shared contract (scan, read, not-found, permission-required, corrupted) — observed via contract suite.
2. SHA-256 via worker pool; background decode runs before hash — observed via hash + assetPool tests.
3. Fast path reuses hash on matching root/path/size/mtime; mismatched root forces re-hash — observed via hash tests.
4. `matchAssets` prefers hash, falls back to metadata, one-to-one — observed via match tests.
5. `contentHash` accepts 64 lowercase hex and rejects other shapes — observed via parse tests.
