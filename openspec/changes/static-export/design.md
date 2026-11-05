## Decisions

1. `exportSiteStore.ts`: module store (`subscribe` / `getSnapshot`) over a pure `reduceExportSite`: `idle` → `running {phase: prepare|render|write, done, total}` → `done {books, files, bytes}` / `failed {code}`; `start` is ignored while running (one run). `done` → `idle` after 4 s; opening `failed` → `idle`. Progress reaches React at most every 250 ms (rAF-batched).
2. `exportSiteRun.ts` (injected deps): at Export it re-requests readwrite permission, freezes the open book with `publishBook(meta, book, now)`, saves `library.json` + `published.json` through `LibraryStorage`, loads the other published revisions, prepares derivatives, then posts `{folder, input}` to `site-export.worker.ts` with the derivative buffers transferred. No library (session book): meta `{}` in memory, only the open book.
3. Derivatives: `requestDerivatives` (existing pool, slot cap 1, gated by interaction) one asset at a time (prepare progress) for every revision asset with a `contentHash`; bytes via `getDerivative`; width / height from the encoded header (`encodedImageSize.ts`: WebP VP8 / VP8L / VP8X and JPEG SOF; cache entries have no dims). The source comes from the retained session file or the registered source root. Progress maps to one percent: prepare 0–30, render 30–80, write 80–100 (kit phase bands). `?fixture=painter&hashes=1` gives the fixture assets content hashes so e2e exports real images.
4. Folder handle: new session IDB store `site-export-folders` (DB v5), keyed by library id (`session` without one).
5. Pill: `ChromeButton` moves to `ChromeButton.tsx`. A hidden rest-content sizer and the live content share one grid cell, so the width stays the same in every state. The fill is a `::before` `scaleX` over `--control`. Below 1280 px it is icon-only. `circle-check` / `loader` are inline lucide paths in the export module (`glyphs.ts` is owned by another lane).
6. Texts (books sentence, phase, status, fail, summary) are pure functions in `exportSiteText.ts`.
7. Security: handle only from the picker, permission re-requested on Export, writes confined to `dist/` by `writeSiteTree` (foreign `dist/` refused).

## Touch-set & Test Plan

| File                                            | Why                      |
| ----------------------------------------------- | ------------------------ |
| `src/editor/EditorTopBar.tsx`                   | pill after Settings      |
| `src/editor/EditorTopBar.test.tsx`              | pins                     |
| `src/editor/ChromeButton.tsx`                   | shared pill button       |
| `src/editor/export/ExportSiteButton.tsx`        | pill                     |
| `src/editor/export/ExportSiteButton.css`        | sizer, fill, dialog      |
| `src/editor/export/ExportSiteButton.test.tsx`   | pill unit                |
| `src/editor/export/ExportSiteDialog.tsx`        | dialog                   |
| `src/editor/export/ExportSiteDialog.test.tsx`   | dialog unit              |
| `src/editor/export/exportSiteGlyphs.tsx`        | lucide icons             |
| `src/editor/export/exportSiteStore.ts`          | store                    |
| `src/editor/export/exportSiteStore.test.ts`     | transitions, throttle    |
| `src/editor/export/exportSiteRun.ts`            | run wiring               |
| `src/editor/export/exportSiteRun.test.ts`       | run unit                 |
| `src/editor/export/exportSiteText.ts`           | labels                   |
| `src/editor/export/exportSiteText.test.ts`      | books sentence 0/1/2/4+  |
| `src/derivatives/encodedImageSize.ts`           | WebP / JPEG dims         |
| `src/derivatives/encodedImageSize.test.ts`      | VP8 / VP8L / VP8X / SOF  |
| `src/editor/projectSession.ts`                  | `getLibraryStorage`      |
| `src/editor/session/libraryActivation.test.ts`  | fake storage API         |
| `src/project/session/idb.test.ts`               | DB v5                    |
| `src/testFixtures/loadPainterFixture.ts`        | `&hashes=1`              |
| `src/editor/export/exportSiteFolder.ts`         | folder handle in IDB     |
| `src/editor/export/exportSiteFolder.test.ts`    | remember / permission    |
| `src/site/export/createSiteExportWorker.ts`     | worker factory           |
| `src/project/types.ts`                          | storage API              |
| `src/project/memory.ts`                         | published map            |
| `src/project/fsa/fsaLibraryStorage.ts`          | published IO             |
| `src/project/fsa/layout.ts`                     | `published.json`         |
| `src/project/publishedStorage.test.ts`          | round trip both adapters |
| `src/project/session/idb.ts`                    | folder store             |
| `src/editor/session/bookLockController.test.ts` | fake storage API         |
| `e2e/static-export.spec.ts`                     | 4 cases + perf gate      |

Reuse: `publishBook`, `requestDerivatives` / `getDerivative`, `runSiteExport`, `Dialog`, `Button`, `ProgressBar`, `Icon`, tokens `--field` / `--control` / `--color-meter` / `--shadow-xs`.
