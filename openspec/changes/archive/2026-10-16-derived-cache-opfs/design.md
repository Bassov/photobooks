# Design

## Context

See proposal.md. `AssetSource` lives in `src/assets/`. Tiers: `tierCache` + `ObjectUrlLru`. Thumbs: `thumbCache` filled by `importPhotos` → `setThumbUrl` (no miss/request path today). Live import does not fill `contentHash` yet.

## Goals / Non-Goals

**Goals:** Domain `DerivedCache` + memory/OPFS + contract suite; wire tier/thumb put + hydrate when hash known; keep hot LRUs/pacing; clear public seams.

**Non-Goals:** Hashing on import, open/save UI, tier ladder / filmstrip UX changes, quota UX, AVIF/site derivatives.

## Decisions

1. **Modules** — `src/assets/derivedCache/types.ts`, `memory.ts`, `opfs.ts`, `presets.ts` (stable `thumb` / `tier-320`…), `derivedCache.contract.test-helpers.ts`; export from `src/assets/index.ts`.

2. **Domain API** — Entries are `{ bytes: ArrayBuffer, mimeType: string }` (mime required for `Blob`/`createObjectURL`). Methods: `get` / `put` / `delete` / `clear`. Failures: `not-found`, `corrupted`. No paths/handles. OPFS: root under `navigator.storage.getDirectory()` (`photobooks-derived`); one file per key; on-disk envelope = uint32 BE mime UTF-8 byte length + mime bytes + raw image bytes; put via writable replace; harness seeds junk for `corrupted`. Contract factory may inject the root directory handle.
   - **Alt:** raw `ArrayBuffer` only — rejected (loses mime). IndexedDB — rejected (architecture says OPFS).

3. **Process default** — Lazy `createOpfsDerivedCache()` in app; `createMemoryDerivedCache()` + `setDerivedCacheForTests` in unit tests.

4. **Tier seam** — `requestTier(assetId, tier, contentHash?: string)`. On miss: register the same inflight key **before** async work; if `contentHash`, `get` first and on hit enqueue the existing pending + one-URL-per-frame flush (no encode, no immediate `createObjectURL`); else encode as today. After encode, `put` when hash present. Concurrent callers share inflight so hydrate cannot race a second encode. **Call site:** `ConnectedSpreadView` passes optional hash from the asset record (same store helper as filmstrip).

5. **Thumb seam** — Add `ensureThumb(assetId, contentHash?: string)` on `thumbCache`: if hot URL exists, no-op; if hash, inflight-deduped `get` then enqueue the existing thumb flush path; if miss/no hash, no-op (import still owns encode). `setThumbUrl(..., contentHash?)` puts when hash present after encode. **Call sites:** `importPhotos` passes hash when known; `FilmstripItem` calls `ensureThumb` with hash from the asset record. No UX change when hash absent.

6. **Hash lookup** — Thin `bookStore` helper (e.g. `getAssetContentHash(assetId): string | undefined`) reading optional `contentHash` from the current book’s asset map; used by FilmstripItem and ConnectedSpreadView. Producing hashes on import is out of scope.

7. **Workers** — Cache stores already-encoded preview bytes only; no new main-thread decode/resize.

## Touch-set

`src/assets/derivedCache/**`, `src/assets/index.ts`, `src/photo/tierCache.ts` (+tests), `src/editor/thumbCache.ts` (+tests), `src/editor/importPhotos.ts`, `src/editor/FilmstripItem.tsx`, `src/editor/ConnectedSpreadView.tsx`, `src/editor/bookStore.ts` (contentHash helper), `AGENTS.md` / knip / stryker as needed. No e2e / LHCI.

## Composition

`src/assets` = persistence; `tierCache`/`thumbCache` = hot URLs + notify. No `assets` → `editor`. Photo/editor may import `assets`. Core stays pure.

## Tests

Contract suite: put/get (incl. mime), miss, delete, clear, corrupted, OPFS new-instance persistence. Tier: hashed hydrate skips encode (mock cache + inflight); put after encode; unhashed never puts. Thumb: `ensureThumb` hydrate; `setThumbUrl` put; unhashed skip. Shared byte fixtures. No Playwright.

## Security

OPFS origin-private; no handles/paths on domain API; revoke object URLs on LRU eviction; do not store full originals under preview presets; no CSP changes. Treat as security-tagged (blob URLs + OPFS): `pnpm audit:ci` + Security Review before archive (same bar as asset-identity).

## Risks / Trade-offs

- [No live hashes] → Wiring + tests with injected hash; production stays memory-only until open-save-project.
- [OPFS in Vitest] → Injected root / skip clearly if environment lacks OPFS.
- [LOC] → Thin Filmstrip / ConnectedSpreadView / bookStore / import wiring only.

## Migration Plan

Additive. Rollback = revert PR. Clearing OPFS is safe (rebuildable).
