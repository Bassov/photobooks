## Proposal

Roadmap: `docs/roadmap/P4/cover-pdf-paint.md` (scope / Done when). Reference: Designer `cover-pdf` spec §2.5 (CP2, C3/C4/C6).

### Scope out

- Print dialog, file name and cover Check rows (items `cover-pdf`, `cover-pdf-check`).
- Spine colour on the canvas (item `cover-pdf`); kit (`cover-pdf-kit`).

### Delta / Risk

- New cover painter shares fonts / text layout with pdf-captions; the title shadow is not printed (C7).
- `CoverView` takes the photo anchor from `coverPhotoAnchor` (`pdfGeometry.ts`); the canvas look stays the same.
