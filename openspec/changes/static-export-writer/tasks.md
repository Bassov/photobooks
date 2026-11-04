## Implementation

- [x] 1. Planner `planSiteWrite` + manifest check + `siteExportErrorCode` in `src/site/export/writeSiteTree.ts`, with unit tests (empty, earlier export, foreign, kind change) — `writeSiteTree.test.ts` `planSiteWrite` / `isSiteManifest` / `siteExportErrorCode`.
- [x] 2. Writer `writeSiteTree` (listing, deletes, manifest-first writes, progress callback) over `SiteDirectoryHandle`; in-memory handle test helper with an op log — `memorySiteDirectory.test-helpers.ts`, `writeSiteTree.test.ts` `writeSiteTree`.
- [x] 3. PBT ×1000: write twice → byte-identical; file set equals tree; foreign dir unchanged — `writeSiteTree.pbt.test.ts`.
- [x] 4. `src/site/export/site-export.worker.ts` (`runSiteExport` + `onmessage` shell) with tests: progress ≥250 ms apart, done totals, failure codes — `site-export.worker.test.ts`.
- [x] 5. Add-only `publishedRevisions` export in `buildSiteTree.ts` for the book count (no `index.ts` exports: knip rejects unused ones; `static-export` adds them).

## Manual test scenarios

N/A (no UI; the e2e and manual walk come with `static-export`).
