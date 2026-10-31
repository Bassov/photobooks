## Proposal

Roadmap: `docs/roadmap/P1/folder-manifest-batched-dims.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Manifest format, IndexedDB schema, decode / JPEG head-pass concurrency.
- Filmstrip / slot-width rendering (only the persisted dims change).

### Delta / Risk

- `patchManifestDimensions` resolves after the coalesced write holding it (≤ 500 ms idle wait), not after its own write; its only prod caller is fire-and-forget.
