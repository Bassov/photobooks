# pdf-frame-looks

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item pdf-frame-looks

## Scope

- [ ] PDF painter draws frame looks (stroke, mat, corner radius) like the canvas
- **Goal:** PDF frame looks (stroke, mat, radius): `src/core/pdf/paintPdf.ts` draws a photo frame's `FrameStyle` the way the kit canvas does (`uikit/src/sandbox/canvas.tsx` `FrameBody`): mat fills the frame box, the photo is inset by the mat, the stroke sits on top inside the frame edge, the corner radius clips mat and photo
- **Done when:** a frame with `strokeMm 0.3 #1c1b1a`, `matMm 3 #ffffff`, `cornerRadiusMm 4` paints the mat fill, a clip path with curves, the image and a stroke 0.3 mm wide in pt (±0.01); a frame with no style paints the same operators as before (existing paintPdf tests unchanged); PBT on the pure look geometry: photo rect = frame rect inset by the mat on every side and never negative, radius clamped to half of the shorter side, stroke stays inside the frame box
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** pure look geometry beside `src/core/pdf/pdfGeometry.ts`, reusing its mm→pt and frame matrices; mm values read from the resolved `FrameStyle` only (never the presets of `src/core/ops/frameLook.ts`)
- **Hard nos:** no UI; no new dependencies; no edits outside `src/core/pdf/**` (`src/render/**`, `src/editor/**`, `src/core/ops/**`, `uikit/**`, `src/publish/**` are off)
- **Test:** unit + PBT on the pure module; no e2e (no UI)
- **Browser check:** n/a (prep, PDF bytes only)
- **Depends:** pdf-painter
