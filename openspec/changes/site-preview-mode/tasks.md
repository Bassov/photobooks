## Implementation

- [ ] 1. `sitePreviewKeys.ts` pure map + unit / PBT tests.
- [ ] 2. `editorKeysGate.ts` and the gate in the editor's capture key listeners (Space pan, camera zoom, crop, nudge, Fit & crop).
- [ ] 3. `SitePreviewBar.tsx` + lazy `SitePreview.tsx` (shell, embedded book page, `PreviewSlide`, keys, focus).
- [ ] 4. `EditorShell` / `EditorFrame`: canvas stays mounted, frame `inert`, focus back on `present`; top bar `title="Preview site"`.
- [ ] 5. Delete `PresentationMode` + its unit test + `e2e/presentation-mode.spec.ts`; update EditorShell / lowDpiBadge unit tests.
- [ ] 6. `e2e/site-preview-mode.spec.ts` (values, steps, Browser check, inert keys, Esc restore, Fullscreen order, Tab trap, no document scroll, perf) and the presentation → site-preview e2e updates.

## Manual test scenarios

1. Open the fixture editor, select a frame on spread 2, zoom in and scroll; Preview → the site book page on the cover under a 48 px bar; → steps; Fullscreen, Esc closes the lightbox, Esc again returns to the same spread, selection, zoom and scroll, with focus on Preview.
2. Change the cover title, Preview again → the h1 shows the new title.
