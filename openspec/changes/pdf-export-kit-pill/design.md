## Decisions

1. `usePrintRun(ms = 1400)` in `dialogs.tsx` beside `useExportRun`: `{ phase, p, text, fail, start(sheets), seen }`; `p` / `text` from `printProgress`; `start` fails at once on a `takePrintFail()` seed; done → idle after 4 s; `seen()` clears failed. `DemoEditor` owns it, so Hide / Esc unmount the dialog and the run continues.
2. `PrintDialog` takes `run?: PrintRun` (own run when absent) and follows it while open (run → done / failed in place), like `ExportSiteDialog`. Feature pages pass frozen runs (like `RUN_42`) and `EditorView` gains a `print` pill prop.
3. The Print pill reuses `SiteJobPill` (quiet #D7D7D7, `rounded-full`, `h-8`, `px-3`, `bg-control` fill) with `PRINT_PILL` texts, label always empty → icon-only 40 × 32. No `wait` (not a P7 site job). Pill press: step from phase (idle → opts) + `seen()`. Kit only, no new tokens; skill `ui-review` before push.
4. The Export site label hides below 1424 px: `max-[1423.98px]:hidden` (D2).

## Touch-set & Test Plan

| Path                               | Why                                             |
| ---------------------------------- | ----------------------------------------------- |
| `uikit/src/demo-parts/dialogs.tsx` | `usePrintRun`, PrintDialog `run` prop           |
| `uikit/src/demo-parts/editor.tsx`  | Print pill, breakpoint, DemoEditor / EditorView |
| `uikit/src/features/pages.tsx`     | `pdf-export` states, 1424 texts                 |
| `uikit/scripts/demo-capture.mjs`   | print steps renamed per Spec §3                 |
| `e2e/kit-pdf-export.spec.ts`       | PE4 pill, layout, run lifecycle, feature states |
| `e2e/kit-in-app-publish.spec.ts`   | K3 1360 → 1424                                  |

- Reuse: `SiteJobPill`, `useRun`, `printProgress`, `takePrintFail`, `paintProbe`. Demo capture run as evidence (baselines untracked).
