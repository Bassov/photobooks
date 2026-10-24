## Implementation

- [x] 1. OpenSpec deltas: `asset-source` (batched import + prioritized re-scan), `frame-budget` (large-folder responsiveness + used-first), `editor-shell` (progress), `derived-cache` (lazy unused hashes MUST NOT block Save); trim obsolete sync-walk expectations.
- [x] 2. First import: picker returns handle without full main-thread collect; worker scan + batched File resolve / import with incremental `import-progress`.
- [x] 3. Pure priority planner: visible-spread placed → open-book assets → other books by `sourceRootId`+`relativePath`; unit-lock order.
- [x] 4. Reload: prioritized verify/re-hash first; remaining entries idle/cancellable (not directory order); wire from `restorePhotoFolderForActiveBook` / regrant.
- [x] 5. Placeholder progress for scan/re-scan (existing Status/ProgressBar; stable testids).
- [x] 6. Perf check: ~3k–4k synthetic images via memory/FSA doubles — no long task ≳100 ms; used-in-book finish before lazy; integrate without weakening budgets.
- [x] 7. Update/extend existing import + restore unit/e2e; keep filmstrip scrollport asserts.

## Manual test scenarios

1. Empty folder (0 images): Choose photo folder… → status/empty guidance; no freeze; no page-level scroll.
2. Choose a large photo folder (~hundreds+): UI stays interactive; `import-progress` advances; filmstrip fills progressively; no page-level scroll.
3. Place photos, reload with granted handle: used/placed originals verify first; chrome stays responsive; Change photo folder… still available.
4. Change photo folder (confirm): prior gallery clears, new import progresses without a long freeze.
