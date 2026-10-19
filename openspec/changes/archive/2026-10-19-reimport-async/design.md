# Design

## Context

See proposal.md. Library-backed `importPhotoFilesInner` awaits `Promise.all` over every `arrayBuffer()` (+ main-thread `bytes.slice(0)` for hash) before `enqueueGalleryAssets` / `runImportBatch`. Session path already enqueues from cheap identity. `upgradeSessionAssetsForLibrary` has the same whole-set read barrier. `runImportBatch` already chunks decode at `START_CHUNK = 16`. Hash jobs already sit at `'hash'` priority behind decode; Save uses `awaitPendingHashes`.

## Goals / Non-Goals

**Goals:**

- Library import shows placeholders + progress before any body read finishes (same UX as session).
- Cap concurrent body reads at 16; drop whole-set `Promise.all` and unbounded `bytes.slice(0)`.
- Same capped upgrade path for session→library.
- Prove no-duplicates on re-import (test first; implement match/reuse only if needed).
- Library-backed 200-file re-import e2e: first-card ≤1.5× session, LoAF/INP/handler budgets.

**Non-Goals:**

- Moved-folder relink (`missing-assets-relink`).
- New workers, subsystems, or dependency bumps.
- Edits to parallel-session paths (`scripts/**`, `book-titles` editor/home/title files, `openspec/specs/editor-shell`).

## Touch-set

- `src/editor/importPhotos.ts` — identity-first enqueue; capped per-file seed/hash reads; optional reuse of existing assets on re-import
- `src/editor/upgradeSessionAssets.ts` — capped parallel reads (≤16), no whole-set barrier before progress of individual upgrades
- `src/editor/importPhotos.identity.test.ts` — never-resolving `arrayBuffer` + in-flight cap; no-duplicates unit
- `src/editor/upgradeSessionAssets.test.ts` — capped-read assertions as needed
- `e2e/filmstrip.spec.ts` (or sibling) — library-backed re-import timing + frame-budget + no-duplicates
- `openspec/specs/photo-card/spec.md` — via delta sync on archive
- Nested roadmap ticks in `docs/roadmap/M2.2/reimport-async.md`

Assumption: reuse matching stays inside `importPhotos` (gallery lookup by relativePath+size+mtime, then contentHash when available); no change to `src/assets/match.ts` unless a tiny pure helper is clearly shared — prefer local lookup to keep the touch-set small.

## Decisions

1. **Enqueue identity first, read later** — Build gallery entries from `relativePath` / `file.size` / `file.lastModified` immediately (mirror session branch). Seed `memorySource` + hash after enqueue, paced with a semaphore of 16 in-flight `arrayBuffer()` calls. Decode via existing `runImportBatch` proceeds without waiting for all seeds.
2. **No whole-set `bytes.slice(0)`** — Pass the same buffer (or a single-file copy inside the capped window) into `hashContent`; never `Promise.all` over the selection.
3. **Reuse before mint (only if no-duplicates test fails)** — Before `mintAssetId`, look up an existing gallery asset with same relativePath+byteSize+mtimeMs (and contentHash when both known). Reuse id + retain File; refresh seed/hash/thumbs. If the test already passes without code change, keep the test and leave mint behavior alone.
4. **Upgrade path** — Same 16-cap map over `toUpgrade`; patch identity as each read completes; hash remains best-effort behind `trackHashJob`.
5. **E2E** — `attachMemoryLibraryForTests` + `createBookInLibrary`, import 200, clear DerivedCache thumbs, re-import same fixtures; assert progress + first-card timing vs a session-path measurement in the same run; scroll window for LoAF/handler/INP.

## Composition

Thin orchestration in `importPhotos` / `upgradeSessionAssets`; domain decode/hash stay in `assetPool` / `hashContent`. No new React surface; Filmstrip already reveals progressive gallery ids.

## Tests

| Surface      | Public API                                 | Assert                                                                                                                                                                   |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit         | `importPhotoFiles` (`libraryBacked: true`) | enqueue + first `processAsset` before any `arrayBuffer` resolves; ≤16 pending reads                                                                                      |
| Unit (+ e2e) | re-import same files                       | gallery count stays N; same asset ids; thumbs restored                                                                                                                   |
| E2E lock-ins | library re-import 200                      | **empty:** cleared DerivedCache; **happy:** Importing + progressive placeholders/thumbs, first-card ≤1.5× session; **scroll:** zero LoAF; handler p95 ≤4 ms; INP ≤100 ms |

## Security

No new FSA surface; memory seed still holds bytes only for registered roots. Workers continue to receive `ArrayBuffer` only. Hash failure stays best-effort (identity persists).

## Risks / Trade-offs

- [False reuse of a different file with same path/size/mtime] → require contentHash when available; append when no match.
- [Decode starts before seed completes] → `retainAssetSource` already holds the File for decode; seed is for library identity / cache keys only.
- [Parallel book-titles touching projectSession] → use existing test hooks only; do not edit `projectSession.ts` unless unavoidable (then minimal + call out in PR).
