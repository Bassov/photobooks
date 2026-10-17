# asset-identity

Tag: prep
Milestone: M2
Title: content-addressed assets

## Scope

- [x] `AssetSource` interface (read-only originals, folder scan) with memory and File System Access adapters
- [x] SHA-256 hashing in the worker at lowest priority; size + mtime fast path
- [x] Pure matching / relink function
