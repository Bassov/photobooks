# ui-editor-shell-v93

Tag: feature
Milestone: M2.6
Title: Port editor shell chrome from kit v0.9.3
Status: done

## Scope

- [x] Port editor shell chrome from kit (header, panels, filmstrip dock, inspector chrome) into product
- [x] **Keep working logic:** FSA import, `bookStore` / `projectSession`, filmstrip place/crop, checking-photos reload
- [x] Existing product chrome may be thrown away where it conflicts with kit layout
- [x] Preview is in-app preview of the current book (not published site)
- **UI kit:** `uikit/src/sandbox/chrome.tsx`, `uikit/src/features/screen-demos.tsx` (`editor`), `UI ref: uikit#/full/editor`, `UI ref: uikit#/demo` (editor stage), `UI ref: uikit#/screen/editor`
- **Browser check:** Open a book: kit chrome; place/replace via filmstrip drag still works; crop from inspector; folder import and checking-photos reload still behave
- **Perf:** Editor interaction scenarios stay at zero LoAF; hot handlers p95 ≤ 2 ms; INP ≤ 100 ms (`src/perf/budgets.ts`)
- **Size:** prefer split if over ~1500; one PR for shell chrome only
- **Source:** Owner package I
