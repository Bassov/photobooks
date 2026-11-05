## Implementation

- [ ] 1. Storage: `LibraryStorage.loadPublished` / `savePublished` (memory + FSA `published.json`), round-trip test for both adapters; session IDB v5 store `site-export-folders`; `getLibraryStorage()` on the project session.
- [ ] 2. Pure parts: `exportSiteStore.ts` reducer + module store (one run, 250 ms rAF-batched progress, done → idle after 4 s, failed → idle on open); `exportSiteText.ts` (books sentence, phase, percent, status / title, fail texts, summary); `encodedImageSize.ts` (WebP / JPEG dims); unit tests.
- [ ] 3. Run wiring: `exportSiteRun.ts` (permission, `publishBook`, saves, other revisions, derivatives via the pool, worker post with transfers, messages → store), `createSiteExportWorker.ts`, `exportSiteFolder.ts` (picker + IDB); unit tests with injected deps.
- [ ] 4. UI: `ChromeButton.tsx` extracted; `ExportSiteButton` (sizer, fill, states, status region, icon-only < 1280) after Settings; `ExportSiteDialog` (Options / Running / Done / Failed per Designer spec §2); `EditorTopBar.test.tsx` pins; unit tests.
- [ ] 5. e2e `e2e/static-export.spec.ts`: happy path (Hide + drag, `dist/index.html`, drafts absent, pill rect stable), byte-identical rerun, foreign `dist/`, perf gate (drag during export, zero LoAF, longest task); `?fixture=painter&hashes=1`.

## Manual test scenarios

1. Editor with spreads: Export site pill after Settings; Options with no folder → Export disabled; Choose folder… → folder field + hint; Export → Running; Hide; pill shows NN% with fill, same width; drag a frame smoothly; pill "Exported" then back to "Export site"; reopen → Options.
2. Folder with a foreign `dist/` → Failed "isn’t a Photobooks export" with "Choose folder…".
3. Viewport < 1280 px: pill is icon-only 40×32.
