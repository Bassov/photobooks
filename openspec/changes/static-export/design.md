## Decisions

1. One module store (`exportSiteStore.ts`, pure reducer): idle / running / done / failed; one run at a time; progress reaches React at most every 250 ms.
2. Export freezes the open book with `publishBook` and saves `library.json` + `published.json` through `LibraryStorage` (session book: in memory only). Prerender and writes stay in `site-export.worker.ts`; the main thread only fetches cached derivatives (pool, slot cap 1, interaction-gated) and posts them transferred.
3. Cache entries have no dimensions: read them from the encoded WebP / JPEG header (`encodedImageSize.ts`).
4. Folder handle: session IDB v5 store `site-export-folders`, keyed by library id; the site-export requirement is the behaviour SoT (no session-state delta).
5. Pill reuses `ChromeButton` (moved to its own file); a hidden rest-content sizer keeps its width in every state. `circle-check` / `loader`: inline lucide paths (`glyphs.ts` belongs to another lane).
6. Security: handle only from the picker, readwrite re-requested on Export, writes confined to `dist/` by `writeSiteTree`.
7. UI: skill `ui-review` before push; e2e covers empty, happy, Hide + drag and foreign `dist/`.

## Touch-set & Test Plan

| File                                          | Why                      |
| --------------------------------------------- | ------------------------ |
| `src/editor/EditorTopBar.tsx`                 | pill after Settings      |
| `src/editor/EditorTopBar.test.tsx`            | pins                     |
| `src/editor/ChromeButton.tsx`                 | shared pill button       |
| `src/editor/export/ExportSiteButton.tsx`      | pill                     |
| `src/editor/export/ExportSiteButton.css`      | sizer, fill, dialog      |
| `src/editor/export/ExportSiteButton.test.tsx` | pill unit                |
| `src/editor/export/ExportSiteDialog.tsx`      | dialog                   |
| `src/editor/export/ExportSiteDialog.test.tsx` | dialog unit              |
| `src/editor/export/exportSiteGlyphs.tsx`      | lucide icons             |
| `src/editor/export/exportSiteStore.ts`        | store                    |
| `src/editor/export/exportSiteStore.test.ts`   | transitions, throttle    |
| `src/editor/export/exportSiteRun.ts`          | run wiring               |
| `src/editor/export/exportSiteRun.test.ts`     | run unit                 |
| `src/editor/export/exportSiteText.ts`         | labels                   |
| `src/editor/export/exportSiteText.test.ts`    | books sentence 0/1/2/4+  |
| `src/editor/export/exportSiteFolder.ts`       | folder handle in IDB     |
| `src/editor/export/exportSiteFolder.test.ts`  | remember / permission    |
| `src/derivatives/encodedImageSize.ts`         | WebP / JPEG dims         |
| `src/derivatives/encodedImageSize.test.ts`    | VP8 / VP8L / VP8X / SOF  |
| `src/site/export/createSiteExportWorker.ts`   | worker factory           |
| `src/project/types.ts`                        | storage API              |
| `src/project/memory.ts`                       | published map            |
| `src/project/fsa/fsaLibraryStorage.ts`        | published IO             |
| `src/project/fsa/layout.ts`                   | `published.json`         |
| `src/project/publishedStorage.test.ts`        | round trip both adapters |
| `src/project/session/idb.ts`                  | folder store             |
| `src/project/session/idb.test.ts`             | DB v5                    |
| `src/editor/projectSession.ts`                | `getOpenLibrary`         |
| `src/editor/export/startExportSite.ts`        | browser deps             |
| `src/lib/sha256Hex.ts`                        | hash unhashed photos     |
| `src/lib/sha256Hex.test.ts`                   | digest hex               |
| `vite.config.ts`                              | worker: no CSS inject    |
| `e2e/static-export.spec.ts`                   | 4 cases + perf gate      |
| `e2e/design-r11-topbar.spec.ts`               | cluster ends at Export   |

Reuse: `publishBook`, `requestDerivatives` / `getDerivative`, `runSiteExport`, `Dialog`, `Button`, `ProgressBar`, `Icon`, tokens `--field` / `--control` / `--shadow-xs`.
