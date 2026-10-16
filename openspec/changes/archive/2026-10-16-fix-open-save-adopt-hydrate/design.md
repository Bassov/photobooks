# Design

## Context

See proposal.md. `adoptCurrentBookInLibrary` exists as a test/perf seam but is unwired in chrome; `createLibrary` binds with `bookId=null` and Save stays disabled. Session import keeps `File`s via `retainAssetSource` but writes empty asset records. After reload, Files are gone; hydrate depends on `contentHash` + DerivedCache. Today: thumb encode may finish before hash (no `put`); spreads request tier presets that import never wrote; `sessionMeta.aspect` is not in `book.json`.

## Goals / Non-Goals

**Goals:** Wire adopt into create/open/Save; upgrade session assets on adopt; durable put-after-hash + tier→thumb fallback; restore aspect from hydrate without main-thread image decode; e2e for both exploratory bugs.

**Non-Goals:** Schema width/height; photo-folder FSA persistence; autosave; new subsystems.

## Decisions

1. **Auto-adopt after bind** — `createLibrary` / `openLibrary` (and test attach when `bookId` null) call `adoptCurrentBookInLibrary` after successful `bindLibrary`. Save/Ctrl+S: if library open and `bookId` null → adopt then save; else `saveBookNow`. Enable Save whenever `libraryOpen`.

2. **Identity upgrade on adopt** — Public `upgradeSessionAssetsForLibrary()` under `src/editor/`: for gallery ids with `getAssetSource` and missing identity, one memory `AssetSource` root, seed files, `patchAssetRecord` path/size/mtime, async `hashContent` → patch hash + backfill hot thumb/tier buffers into DerivedCache. Call from adopt before `createBook`.

3. **Hash settle before durable save** — Track in-flight hash jobs from upgrade and library-backed import. `saveBookNow` (and Save after adopt) **awaits** those jobs settling, then writes once. No follow-up re-save path in this change.

4. **Put-after-hash** — `thumbCache` keeps last buffer per asset; on `contentHash` arrival, `put` thumb preset. Same for tier buffers when present. Import `onResult` no longer depends on hash already being present.

5. **Tier fallback** — In `requestTier`, after tier miss and no File: `cache.get(hash, THUMB_PRESET_ID)` and publish that buffer as the tier display URL.

6. **Aspect from hydrate (no main-thread decode)** — After hydrated bytes are available: if `image/jpeg`, use pure `readJpegSofSize` for dims; otherwise build a `File` from the buffer and call existing `processAsset` (worker) at background priority / small `maxEdge` only to read `correctedWidth`/`correctedHeight`, then `setAssetSessionMeta`. Never `createImageBitmap` / `<img>` decode on the main thread for this path.

7. **New book confirm** — If gallery length > 0 or any frame has `assetId`, `window.confirm` before `createBookInLibrary`; cancel no-ops.

## Touch-set

`projectSession.ts`, `EditorShell.tsx`, `upgradeSessionAssetsForLibrary` (+tests), `importPhotos.ts`, `thumbCache.ts`, `tierCache.ts`, `e2e/open-save.spec.ts`, unit tests beside modules. Reuse memory library / DerivedCache test seams.

## Tests

Public APIs under test: `adoptCurrentBookInLibrary`, `upgradeSessionAssetsForLibrary`, `saveBookNow` (awaits hashes), `setThumbUrl` / `ensureThumb` / `notifyContentHash` (or equivalent put-after-hash seam), `requestTier`, `createLibrary`/`attachLibraryForTests` auto-adopt.

Shared fixtures: `createMemoryLibraryStorage`, `attachMemoryLibraryForTests`, `createMemoryDerivedCache`, `setDerivedCacheForTests`, existing photo JPEG fixtures / `retainAssetSource`.

- Unit: adopt after bind; upgrade identity+hash; put-after-hash; tier→thumb; aspect after hydrate (JPEG SOF + worker path).
- E2E (`e2e/open-save.spec.ts`): session import → attach library → Save (no create-book) → reload → thumbs + placed `img` + landscape not square; empty chrome; New book confirm cancel; reuse `assertDocumentFitsViewport` + `assertNamedScrollport` for filmstrip and pasteboard (named scrollports unchanged). Existing New-book path stays green.
- `ui-review` before push; save-during-drag gate unchanged.

## Security

No new picker modes. Upgrade reads in-session File bytes only; handles never enter `book.json`. Existing FSA library root only.

## Risks / Trade-offs

- [Many hashes on adopt] → Explicit Save awaits settle; background hash worker priority unchanged.
- [Thumb as tier] → Lower-res placed preview after reload until tier re-encoded with File or later relink — preferred over empty frames.
- [Non-JPEG aspect] → Extra worker job per hydrate; JPEG uses SOF only.

## Migration Plan

Additive. Rollback = revert PR.
