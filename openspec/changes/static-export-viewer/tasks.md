## Implementation

- [x] 1. Build plugin emits `site-viewer.json` for the `site` entry; registered in `vite.config.ts`; unit test (`scripts/vite-site-viewer-manifest.test.mjs`).
- [x] 2. `loadSiteViewerBundle` fetches manifest + files, rewrites root-absolute CSS urls and fetches them; unit test (`siteViewerBundle.test.ts`).
- [x] 3. `runExportSite` loads the viewer and sends it in the worker request (transferred); `startExportSite` wires it; unit tests (`exportSiteRun.test.ts`, `startExportSite.test.ts`).
- [x] 4. Worker writes the request's viewer under `dist/viewer/` (`site-export.worker.test.ts`); `buildSiteTree.test.ts` already locks viewer files + page links.
- [x] 5. e2e `e2e/static-export-viewer.spec.ts`: served `dist/` book page at 390×844 and 1440×900 — CSS paint, next page turns, 0 console errors, 0 404s.

## Manual test scenarios

1. Export site into a folder, serve `dist/` statically, open a book page: styled viewer, next page turns.
