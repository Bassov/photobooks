## Decisions

1. Port kit `SettingsScreen` into `src/editor/SettingsScreen.tsx` (nav + Library live + deferred sections). Never import `uikit/src/**`. Tokens/primitives: `--chrome` / `--accent` / `--background` / `--muted-foreground`, `Button`, `Icon`, `IconButton`, `FeaturedIcon`, `Badge`, `AlertDialog` (`docs/design.md`).
2. Keep `ProjectSessionSurface` without `settings` — Library gear toggles a full-page settings shell (back → library) via local state; App still mounts `LibraryScreen` on `library`.
3. Library section: live `libraryLabel` path + session `listLibraryBooks` count; Change uses same kit confirm copy + `changeLibraryFolder()` as Package G. No switch-back toast; no fake preview-cache MB. Content scrolls in `settings-scroll` / `data-scrollport="settings"`.
4. Hosting / Site / Print / Interface: one read-only “coming later” block each — no fake key/value that looks editable.
5. Add glyphs needed for nav (`hardDrive`, `keyRound`, `globe`, `printer`, `slidersHorizontal`); reuse `bookOpen` / `folderSync`.
6. Delta `editor-shell` only (Settings stub → kit shell); no new session-state domain contract.

## Touch-set & Test Plan

- Files: `src/editor/SettingsScreen.tsx` (+ test), `LibraryScreen.tsx` (replace dialog), `src/ui/icons/glyphs.ts` (+ Icon test), `docs/design.md` Settings row, `e2e/library-screens.spec.ts`, OpenSpec `editor-shell` delta.
- Reuse: `LibraryBar` gear, Package G confirm + `changeLibraryFolder`, `src/ui` primitives.
- Tests: unit Settings (sections, count, confirm cancel/open); session surface unchanged; e2e open settings → see count → back + existing change-library; scrollport `assertDocumentFitsViewport`; skill `ui-review` before push.
