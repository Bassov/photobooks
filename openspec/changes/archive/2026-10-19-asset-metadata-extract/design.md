# Design

## Context

Schema v3 metadata fields exist; `processPhoto` already uses `exifr` for orientation/dims/preview. `AssetSource.scanRoot` walks on the main thread (filmstrip shipped note). `matchAssets` returns matched/unmatched only. GPS opt-in lives in `book-core` spec + data-model rule.

## Goals / Non-Goals

**Goals:** Background metadata extract on the existing pool; worker `scanRoot`; `matchAssets` statuses; GPS only when caller passes opt-in (default off).

**Non-Goals:** Missing-assets UI; export pipeline; changing `book-core` GPS policy; live import/editor writers that persist metadata into the open book (this change ships the job + pure mapper returning schema-shaped fields); new deps; gate-config edits.

## Decisions

1. **Metadata extract** — Pure `extractAssetMetadata(buffer, options?)` in `src/assets/extractAssetMetadata.ts` mapping `exifr.parse` → schema fields. `includeGps` defaults false; when true and EXIF has finite lat/lon, set `meta.gps`. Metadata jobs enqueue on `src/photo/metadataPool.ts` (same `photo.worker.ts`); `hashContent` awaits metadata idle so extract stays above hash. Import/session writers that `patchAssetRecord` are **out of scope**.

2. **Worker `scanRoot`** — Shared walk in `src/assets/scanWalk.ts`; `src/assets/scan.worker.ts` runs it. FSA adapter posts the directory handle; memory adapter posts a serializable file table. On transfer/walk failure return typed failure — **no** silent main-thread walk fallback.

3. **`matchAssets` status** — Additive `statuses` map: `ok` | `missing` | `modified` per design rules (path+size/mtime or hash → `ok`; path match + size/mtime differ with hash mismatch or missing hash → `modified`; else `missing`).

4. **GPS policy** — Unchanged from #118: store `meta.gps` only after user opt-in; site export MUST omit GPS. Extractor enforces opt-in at the writer boundary via `includeGps`.

5. **Reuse ladder** — Extend pool + `exifr` (already depended); no new packages.

## Touch-set

| Path                                                | Why                                |
| --------------------------------------------------- | ---------------------------------- |
| `src/assets/match.ts`                               | status map                         |
| `src/assets/match.test.ts`                          | status cases                       |
| `src/assets/extractAssetMetadata.ts`                | pure exifr → schema + GPS opt-in   |
| `src/assets/extractAssetMetadata.test.ts`           | extract fixtures / opt-in cases    |
| `src/assets/scanWalk.ts`                            | shared directory walk              |
| `src/assets/scan.worker.ts`                         | worker entry for scan              |
| `src/assets/scanClient.ts`                          | main-thread enqueue to scan worker |
| `src/assets/fsa/fsaAssetSource.ts`                  | worker scanRoot                    |
| `src/assets/memory.ts`                              | worker scanRoot                    |
| `src/assets/index.ts`                               | exports                            |
| `src/photo/metadataPool.ts`                         | metadata job @ background          |
| `src/photo/poolCoordination.ts`                     | hash waits behind metadata         |
| `src/photo/metadataPool.test.ts`                    | background before hash             |
| `src/assets/hash.ts`                                | await metadata idle before hash    |
| `src/photo/photo.worker.ts`                         | metadata message kind              |
| `openspec/specs/asset-source/spec.md`               | extract + scan + match             |
| `docs/roadmap/M2.2/asset-metadata-extract.md`       | Scope ticks                        |
| `docs/roadmap/archive/M1/editor-shell-filmstrip.md` | close shipped note                 |

## Composition

`src/assets` owns scan walk, match status, and metadata field mapping. `src/photo` schedules the metadata job. Domain types stay handle-free. `src/core` GPS policy unchanged.

## Tests

Public API: `extractAssetMetadata` / `mapExifToAssetMetadata` (opt-in GPS on/off), pool ordering, worker `scanRoot`, `matchAssets` statuses. No e2e/UI/LHCI.

## Security

GPS only on caller opt-in; site-export omit remains `book-core` policy. Workers get bytes or directory handles for scan only; domain API handle-free.

## Risks / Trade-offs

- [Handle transfer] → typed failure, no main-thread fallback
- [Writers deferred] → Scope asks for the job on the pool, not UI persistence
