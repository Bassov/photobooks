# Tasks

## 1. Domain DerivedCache + memory

- [x] 1.1 Add domain types (`DerivedCache` entry `{ bytes, mimeType }`, typed results), preset id constants, `createMemoryDerivedCache`, and shared `runDerivedCacheContract` — verify memory adapter passes the contract suite (put/get+mime, miss, delete, clear, corrupted)

## 2. OPFS adapter

- [x] 2.1 Add `createOpfsDerivedCache` (injectable root; on-disk mime-length envelope; put replace) — verify OPFS adapter passes the same contract suite including put → new instance → get round-trip

## 3. Module surface

- [x] 3.1 Export public API from `src/assets/index.ts`; document `DerivedCache` in `AGENTS.md`; knip/stryker entries as needed — verify `pnpm deps` and imports resolve

## 4. Tier cache wiring

- [x] 4.1 Extend `requestTier` with optional `contentHash`; hydrate via DerivedCache on shared inflight before encode; put after encode; keep one-URL-per-frame flush — verify unit tests: hashed hydrate skips encode, put on encode, unhashed never puts

## 5. Thumb cache wiring

- [x] 5.1 Add `ensureThumb` + optional hash on `setThumbUrl`; hydrate/put through DerivedCache with existing flush pacing — verify unit tests for hydrate, put, and unhashed skip

## 6. Editor call sites

- [x] 6.1 Add thin `bookStore` contentHash helper; wire `FilmstripItem` → `ensureThumb`, `ConnectedSpreadView` → `requestTier(..., hash)`, `importPhotos` → `setThumbUrl` with hash when known — verify existing editor/thumb/tier tests still pass plus hash-aware cases

## 7. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — green under `CI=true` (workers=1, retries=2); one prior LoAF/add-spread flake under load, re-run of full e2e suite green
- [x] pnpm stryker:diff — 65.43% (≥ break 60; 591 killed / 7 timeout / 258 survived / 58 no-cov). Added envelope empty-mime/header-only cases, memory get-byte isolation, `getAssetContentHash` bookStore case. Remaining: OPFS `navigator.storage` default path no-cov (tests inject root); instance OPFS/memory fallback no-cov in unit env; flush/rAF and Blob mime literals in tier/thumb (equivalent under existing pacing tests); cancel/inflight ownership branches; pre-existing bookStore/ConnectedSpreadView/Filmstrip/importPhotos mutants outside new hash seams; empty `cacheKey` string literal equivalent
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no new UI region / no material app-entry bundle claim)
- [x] UI in scope: browser smoke evidenced … — N/A for [prep] (no new UI; thin hash wiring only)
- [x] Docs/rules sync: `AGENTS.md` module map; `docs/future-architecture.md` DerivedCache note; nested roadmap tick at archive
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — security-tagged (OPFS + blob URLs); `pnpm audit:ci` clean
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: b412e97f)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: bce7d803 pass; roadmap wording fixed)
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI [prep]; spec scenarios locked by unit/contract tests (see Manual test scenarios)
- [x] High-risk security surface: Cursor Security Review subagent before archive (evidenced: a766cce7 — no medium+ findings)

## Manual test scenarios

N/A — [prep] with no UI. Spec scenarios locked by `src/assets/derivedCache/*.test.ts`, `src/photo/tierCache.test.ts`, `src/editor/thumbCache.test.ts`, and `src/editor/bookStore.test.ts`:

1. Memory + OPFS adapters pass shared contract (put/get+mime, miss, delete, clear, corrupted; OPFS new-instance persistence) — observed via contract suite.
2. Hashed tier hydrate skips encode; put after encode; unhashed never puts — observed via tierCache tests.
3. Hashed thumb ensureThumb hydrate; setThumbUrl put; unhashed skip — observed via thumbCache tests.
4. `getAssetContentHash` reads optional book asset hash — observed via bookStore test.
