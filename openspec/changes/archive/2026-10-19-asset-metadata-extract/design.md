# Design

## Context

Schema v3 metadata fields exist; `processPhoto` already uses `exifr` for orientation/dims/preview. `AssetSource.scanRoot` walks on the main thread (filmstrip shipped note). `matchAssets` returns matched/unmatched only. GPS opt-in lives in `book-core` spec + data-model rule — no consent flag in code.

## Goals / Non-Goals

**Goals:** Background metadata extract on the existing pool; worker `scanRoot`; `matchAssets` statuses; GPS always stored locally; export/publish strip SHALL.

**Non-Goals:** Missing-assets UI; export pipeline; live import/editor writers that persist metadata into the open book (this change ships the job + pure mapper returning schema-shaped fields); new deps; gate-config edits.

## Decisions

1. **Metadata extract** — Pure `extractAssetMetadata(buffer, mimeHint?)` in `src/assets/extractAssetMetadata.ts` mapping `exifr.parse` → schema fields (`widthPx`/`heightPx`, `orientation`, `capturedAt`, `colorSpace`, `iccProfileName`, `mime`, `meta.*` including `gps` when EXIF has finite lat/lon). Pool enqueue lives in `src/photo/assetPool.ts` as a `metadata` job on decode workers at `'background'` (above `'hash'`), calling the pure mapper inside the worker module. No consent gate. Import/session writers that `patchAssetRecord` are **out of scope** — callers get schema-shaped results only.

2. **Worker `scanRoot`** — Shared walk in `src/assets/scanWalk.ts`; `src/assets/scan.worker.ts` runs it. FSA adapter (`fsaAssetSource.ts`) posts the directory handle into the worker; memory adapter (`memory.ts`) posts a serializable tree and uses the same worker entry. Domain `scanRoot` stays typed/handle-free. On transfer/walk failure return `corrupted` or `permission-required` — **no** silent main-thread walk fallback.

3. **`matchAssets` status** — Additive `statuses: ReadonlyMap<string, 'ok' | 'missing' | 'modified'>` for assets of the scanned `sourceRootId`. `ok`: path+size+mtime match, or contentHash match. `modified`: same root+path, size/mtime differ, and (both hashes present and differ **or** at least one side lacks a hash). `missing`: no hash match and no path entry for that asset. Keep hash-prefer / path-fallback pairing.

4. **GPS policy** — Library MAY store `meta.gps` whenever extracted. Static export/publish (M5/M7) strips GPS by default. Remove opt-in from specs + data-model rule; no consent code.

5. **Reuse ladder** — Extend pool + `exifr` (already depended); no new packages.

## Touch-set

| Path                                                                 | Why                                |
| -------------------------------------------------------------------- | ---------------------------------- |
| `src/assets/match.ts`                                                | status map                         |
| `src/assets/match.test.ts`                                           | status cases                       |
| `src/assets/extractAssetMetadata.ts`                                 | pure exifr → schema                |
| `src/assets/extractAssetMetadata.test.ts`                            | extract fixtures                   |
| `src/assets/scanWalk.ts`                                             | shared directory walk              |
| `src/assets/scan.worker.ts`                                          | worker entry for scan              |
| `src/assets/scanClient.ts`                                           | main-thread enqueue to scan worker |
| `src/assets/fsa/fsaAssetSource.ts`                                   | worker scanRoot                    |
| `src/assets/memory.ts`                                               | worker scanRoot                    |
| `src/assets/index.ts`                                                | exports                            |
| `src/assets/assetSource.contract.test-helpers.ts`                    | contract still green               |
| `src/photo/assetPool.ts`                                             | metadata job @ background          |
| `src/photo/assetPool.test.ts`                                        | background before hash             |
| `src/photo/photo.worker.ts`                                          | metadata message kind              |
| `openspec/specs/asset-source/spec.md`                                | sync on archive                    |
| `openspec/specs/book-core/spec.md`                                   | GPS policy sync                    |
| `.cursor/rules/data-model.mdc`                                       | GPS policy text                    |
| `docs/roadmap/M2.2/asset-metadata-extract.md`                        | Scope ticks                        |
| `docs/roadmap/archive/M1/editor-shell-filmstrip.md`                  | close shipped note                 |
| `openspec/changes/asset-metadata-extract/proposal.md`                | planning                           |
| `openspec/changes/asset-metadata-extract/design.md`                  | planning                           |
| `openspec/changes/asset-metadata-extract/tasks.md`                   | planning                           |
| `openspec/changes/asset-metadata-extract/specs/asset-source/spec.md` | delta                              |
| `openspec/changes/asset-metadata-extract/specs/book-core/spec.md`    | delta                              |
| `openspec/changes/asset-metadata-extract/.openspec.yaml`             | change meta                        |

## Composition

`src/assets` owns scan walk, match status, and metadata field mapping. `src/photo` only schedules the metadata job on the pool and hosts the worker message handler that calls into assets' pure extract (or a worker-local import of the same module). Domain types stay handle-free. `src/core` schema shape unchanged.

## Tests

Public API: `extractAssetMetadata`, `enqueueMetadata` / pool ordering (background before hash), worker `scanRoot` (walk not on main), `matchAssets` `ok`/`missing`/`modified` (incl. path match + size/mtime differ without both hashes → `modified`), GPS without consent. Memory directory fixtures; JPEG/EXIF fixtures as needed. No e2e/UI/LHCI.

## Security

GPS always local; export strip is policy. Workers get bytes or directory handles for scan only; domain API handle-free. No CSP changes.

## Risks / Trade-offs

- [Handle transfer] → typed failure, no main-thread fallback
- [Writers deferred] → metadata may not yet persist in live import until a follow-on wires the job; Scope asks for the job on the pool, not UI
- [match status vs relink] → status additive; keep hash-prefer tests green
