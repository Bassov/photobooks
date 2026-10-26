## Decisions

1. Port kit empty chrome into `src/editor/` (LibraryBar + LibraryEmpty + BookObject + LibStyle) using Tailwind tokens + inventory `Button`/`Icon`/`IconButton` — never import `uikit/src/**`. Inject motion CSS via TS (Welcome pattern) so patch-coverage stays green.
2. Shared `CreateBookDialog` on inventory `Dialog`: title + kit PRESETS (cm) + orientation + custom 10–42 cm; confirm maps `cm→mm` into `createBookInLibrary(title, { trim })`. Default A5 portrait. Replace `promptBookTitle` on library create paths (rename can keep prompt until Package G).
3. Empty branch: example cover (`c18b`) + plain `WelcomePhotoCaption` (extend credits; copy photo into `public/photos/hi/`); primary black Create book; no “0 books” / capsule. Keep Change library = real FSA; Settings stub dialog; with-books list functional but unpolished.
4. Sync `openspec/specs/editor-shell` empty/create requirements to dialog + kit empty chrome. No new capability / schema version.

## Touch-set & Test Plan

- Files: `src/editor/LibraryScreen.tsx` (+ styles), new CreateBook / LibraryEmpty / BookObject / pageSize helpers + tests; `projectSession` create trim option; `welcomeCredits` + `public/photos/hi/c18b.jpg` + PHOTO-CREDITS; icons if missing; `docs/design.md` empty-library row; `e2e/library-screens.spec.ts`; `openspec/specs/editor-shell/spec.md`; roadmap item ticks. No gate/config edits.
- Reuse: `Button`, `Dialog`, `SegmentedControl`, `WelcomePhotoCaption`, `cn`, FSA `changeLibraryFolder` / `createBookInLibrary`.
- Tests: unit — empty chrome testids, dialog cancel/create mapping (preset/custom/orientation→mm), createBookInLibrary trim; e2e — empty observables + create→editor + existing change-library/scrollport. `ui-review` before push.
