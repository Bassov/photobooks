## Decisions

1. `applyUiScale()` runs in `mountPhotobooks` (where the root is created), before `render`; it returns a disposer for its `resize` (rAF) / `storage` listeners. Equal recomputes keep the state object.
2. Export site label breakpoint: `@container app` on `#root` (inline-size), so it follows the app width under zoom.
3. Filmstrip `auto` / max read `appInnerHeight()` (= `innerHeight / s`) and re-render on scale changes; the separator pointer delta stays raw (item 2).
4. `UnsupportedBrowserScreen.css` keeps `100dvh`: a drift test pins it byte-identical to the off-lane kit file; the guard allowlists it until `interface-size-kit`.
5. Spec delta goes to a new `interface-size` capability (editor-shell is at 399 / 400 lines).

## Touch-set & Test Plan

| File                                       | Why                                                       |
| ------------------------------------------ | --------------------------------------------------------- |
| `src/ui/uiScale.ts`                        | core (new)                                                |
| `src/ui/uiScale.test.ts`                   | unit + D4 PBT (new)                                       |
| `src/ui/viewportUnits.test.ts`             | guard (new)                                               |
| `src/ui/mountPhotobooks.tsx`               | apply before render                                       |
| `src/ui/mountPhotobooks.test.tsx`          | `data-ui-scale`                                           |
| `styles/app.css`                           | tokens, `#root` zoom + container, utilities, dialog units |
| `src/editor/WelcomeScreen.tsx`             | `h-app`                                                   |
| `src/editor/LibraryScreen.tsx`             | `h-app`                                                   |
| `src/editor/EditorShell.css`               | app units                                                 |
| `src/editor/EditorShell.test.tsx`          | follows token                                             |
| `src/editor/editorChromeTokens.ts`         | app units                                                 |
| `src/editor/screenPlaceholdersStyles.ts`   | app units                                                 |
| `src/editor/LibraryEmpty.tsx`              | app units                                                 |
| `src/editor/libraryScreenStyles.ts`        | app units                                                 |
| `src/editor/filmstripChromeStyles.ts`      | app units                                                 |
| `src/editor/filmstripChromeStyles.test.ts` | follows token                                             |
| `src/editor/filmstripSize.ts`              | app height                                                |
| `src/editor/FilmstripDock.tsx`             | app height                                                |
| `src/editor/relink/RelinkDialog.tsx`       | app units                                                 |
| `src/editor/print/PrintDialog.css`         | app units                                                 |
| `src/editor/export/ExportSiteButton.css`   | app units, container query                                |
| `src/editor/SitePreview.tsx`               | comment (guard)                                           |
| `src/ui/Dialog.css`                        | app units                                                 |
| `src/ui/AlertDialog.css`                   | app units                                                 |
| `src/ui/Toast.css`                         | app units                                                 |
| `src/ui/SpecimenPage.css`                  | app units                                                 |
| `e2e/interface-size-core.spec.ts`          | IS3 overflow, IS4, IS7, IS10 (new)                        |
| `docs/roadmap/P5/interface-size-core.md`   | item scope                                                |
| `docs/design.md`                           | new tokens (`--ui-scale`, `--app-*`)                      |
| `docs/roadmap.md`                          | index line (`roadmap add`)                                |
