## Implementation

- [x] 1. `SitePreview.test.tsx`: room wording; the room has no link and the head name is plain text (`a portrait / landscape box heads the room with the plain book name`).
- [x] 2. `e2e/site-preview-mode.spec.ts`: no link in the room; pixel paint check (`pixelsAt`) that the room page is painted under the bar (`Preview opens the site book room … (1440 × 900)`).
- [x] 3. Rename `src/site/SiteBookPage.embedded.test.tsx` → `SiteRoom.embedded.test.tsx`; `SitePreview.tsx` doc comment says room; knip 0 (`check:fast` OK knip).

## Manual test scenarios

1. Editor → Preview: the room of the open book under the 48 px bar; no "All books", no Share; the title is plain text.
2. Fullscreen opens the lightbox; Esc closes the lightbox, a second Esc closes the preview.

manual-qa: 1. problem (harness): `start-session` click intercepted by the welcome header, never reached the editor. 2. problem (harness): same. Evidence instead: `e2e/site-preview-mode.spec.ts` 6/6 locally (room, D45 controls, paint, Fullscreen → lightbox, Esc order, inert editor keys).
