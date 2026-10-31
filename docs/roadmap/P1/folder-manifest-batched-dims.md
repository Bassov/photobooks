# folder-manifest-batched-dims

Tag: prep
Milestone: P1
Title: Folder manifest: batch dimension patches, no lost updates
Status: done

## Scope

- [ ] Write a failing unit test first: 200 concurrent `patchManifestDimensions` calls for one root; after settle all 200 dims are present. Today each call reads, parses and rewrites the whole per-root manifest (`src/project/session/sourceRootEntryIndex.ts`), the JPEG head pass runs 16 in parallel, and racing read-modify-writes can drop dims (slot widths jump after reload); total work is O(n²).
- [ ] Per-root coalescing queue: pending patches in a Map; one flush in flight per root (on idle, after ≤ 500 ms, or every 64 patches); a flush is one read-merge-write. `persistScannedEntryIndex` merges pending patches so a walk never drops them.
- **Done when:** the test above passes; n patches cause ≤ ceil(n/64) + 2 flushes; existing manifest / rescan tests green; the large-folder responsiveness harness (`frame-budget` spec "Large folder scan stays responsive") green.
- **Test:** unit + PBT (random interleavings of patch / persist keep every latest patch whose size+mtime match)
- **Hard nos:** no manifest format change; no IndexedDB schema bump
- **Depends:** none
