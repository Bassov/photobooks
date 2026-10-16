# Design

## Context

See proposal.md. `book-core` has optional asset-record fields; none are populated yet. `src/project/fsa` has FSA handle wrappers + memory directory fake. `src/photo` has a session `File` map and a prioritized worker pool (decode/preview). Architecture places `AssetSource` under `src/assets/`.

## Goals / Non-Goals

**Goals:** Domain `AssetSource` + memory/FSA adapters + contract suite; worker SHA-256 with size/mtime fast path; pure match/relink; tighten `contentHash` Zod to 64 lowercase hex; module map + cruiser.

**Non-Goals:** Editor wiring, OPFS cache, permission UX, renaming `src/photo/assetSources.ts`.

## Decisions

1. **Modules (`src/assets/`)** — `types.ts` (domain API + result unions), `memory.ts`, `fsa/fsaAssetSource.ts` (+ thin reuse of project FSA handle types or a local binary-capable fake), `hash.ts` + `hash.worker.ts` / client, `match.ts` (pure), `contract.test-helpers.ts`, `index.ts`. Keep files small.

2. **Domain surface** — Speak ids + domain entries only:
   - `registerRoot({ id })` / adapter-local attach of directory or in-memory tree (factory arg, not on domain methods that leak handles)
   - `scanRoot(rootId)` → entries `{ relativePath, byteSize, mtimeMs }`
   - `readForHash(rootId, relativePath)` → transferable bytes via typed result (domain “content” as `ArrayBuffer`, not `File` / handle)
   - Typed failures: `permission-required`, `not-found`, `corrupted` (extend only if apply needs a shared code already used elsewhere)
   - **Assumption:** registering a root’s platform handle is factory/adapter config (`createFsaAssetSource({ rootId, directory })`), parallel to `createFsaLibraryStorage({ root })`.

3. **Hashing** — Extend the existing `src/photo` asset worker pool with priority `'hash'` (rank below `background`). Generalize queue items by kind (`decode` | `hash`); decode slots keep `photo.worker`, hash jobs use dedicated `hash.worker` slots (or one shared slot table that routes by kind). Export `enqueueHash(buffer)` from `assetPool` for `hashContent` / `resolveContentHash`. Hash jobs post a transferable `ArrayBuffer` (SubtleCrypto `digest`); decode/preview always preempt hash. Public APIs:
   - `shouldReuseContentHash(record, entry)` — pure; true when record has `contentHash` and `sourceRootId`/`relativePath`/`byteSize`/`mtimeMs` all match the scanned entry
   - `resolveContentHash({ record, entry, read })` — if reuse, return existing hash; else `read` bytes and enqueue hash at `'hash'` priority, returning 64 lowercase hex
   - `hashContent(buffer)` — lower-level enqueue used by resolve / tests

4. **Match** — Pure `matchAssets(records, entries)` in `match.ts`. Scanned `entries` MAY include optional `contentHash`. Prefer equal hashes when both sides have one; else secondary key `(sourceRootId, relativePath, byteSize, mtimeMs)`. One-to-one greedy; unmatched listed. No I/O.

5. **book-core** — `contentHash: z.string().regex(/^[0-9a-f]{64}$/)` (or equivalent). No schemaVersion bump (proposal assumption).

6. **Cruiser / docs** — Forbid `core` → `assets`; update `AGENTS.md` map. Do not import React in `src/assets`.

## Touch-set

`src/assets/**`, `src/photo/assetPool.ts` (+ tests for `'hash'` priority ordering), `src/core/schema.ts` (+ parse tests for hash shape), `.dependency-cruiser.cjs`, `AGENTS.md`, `stryker.mutate.md` if worker shell excluded, archive sync specs, nested roadmap ticks.

## Composition

`src/assets` → `src/core` for asset-record types; → `src/photo` only for pool enqueue/priority (narrow). Prefer **no** `assets` → `project` dependency; copy/adapt the memory-directory pattern for binary blobs under `src/assets/fsa`.

## Tests

Public API: factories, contract suite (incl. harness `seedCorrupted` / unreadable entry → `corrupted`), `shouldReuseContentHash`, `resolveContentHash` / `hashContent`, `matchAssets`, pool ordering (visible/background before hash), `parseBook` hash validation. Shared fixtures for in-memory trees and asset records. No e2e / UI / LHCI.

## Security

FSA handles stay adapter-internal / factory-only. Workers receive `ArrayBuffer` + request ids only — never directory handles. Permission → `permission-required` when detectable; else simulated on memory/FSA harness like library-storage. Contract suite forces `corrupted` via adapter-local seed of unreadable/corrupt bytes. No CSP header changes.

## Risks / Trade-offs

- [LOC budget with FSA + hash + pool] → Reuse patterns; if clearly over ~1000 LOC mid-apply, stop and split FSA to a follow-on prep (proposal risk).
- [Session File map confusion] → Distinct names (`createMemoryAssetSource` vs `retainAssetSource`).
- [assets → photo coupling] → Only pool priority/enqueue; keep domain types in `src/assets`.

## Migration Plan

Additive modules + stricter parse for `contentHash`. Rollback = revert PR.
