## Decisions

1. **Primitives adopt, no new subsystem:** Filmstrip status → `Status` + `ProgressBar`; Placed → `Badge` (brand); empty gallery → `EmptyState` (same copy); import errors → error `Toast` (+ Status echo on “Show files”). Editor live line → `Status`. Reuse `src/ui/*`.
2. **Extract over bang growth:** `importErrorToast` helper; `EditorShell` owns `createToastQueue()` + `ToastRegion`; thin `EditorTopBar` callback. Do not enlarge `HomeScreen` / `App`.
3. **Canvas chrome tokens:** Pasteboard/paper/placeholder/selection/drop/focus CSS use `--canvas` / `--paper` / `--muted` / `--select` / `--ring` only; drop-hover stays one `data-drop-hover` attribute; placeholders static.
4. **One pattern:** empty = EmptyState; loading = ProgressBar in status strip; error = Toast. Full error panel deferred.
5. **Perf:** Gates: `drag-place-replace` and filmstrip import scenarios — zero LoAF.
6. **Security:** UI only; import pipeline / FSA unchanged.

## Touch-set & Test Plan

Touch-set: `src/editor/FilmstripStatus.tsx`, `FilmstripItem.tsx`, `Filmstrip.tsx`, `Filmstrip.css`, `EditorShell.tsx`, `EditorShell.css`, `EditorTopBar.tsx`, `importErrorToast.ts`, `src/render/SpreadView.css`, `src/ui/{Badge,EmptyState,Toast,toastQueue}.tsx|ts`, `scripts/manual-qa.mjs`, `docs/design.md`, roadmap item, unit tests, `e2e/filmstrip.spec.ts`.

Reuse: `src/ui/{Status,Badge,EmptyState,ProgressBar,Toast,toastQueue}`. Unit + e2e + Manual + ui-review.
