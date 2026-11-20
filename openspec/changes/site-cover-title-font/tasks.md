## Implementation

- [ ] 1. `coverTitleFace` table; CoverView reads it through CSS vars (no editor visual change).
- [ ] 2. `SiteBookFacts.titleFont`; site `CoverFace` and `Book3D` cover title use the face (sans keeps the site sans).
- [ ] 3. GL front panel font from the face; `book3dGl` loads it.
- [ ] 4. Kit: `titleFace`, `SiteBook.titleFont?`, `CoverFace` and `coverCanvas`.
- [ ] 5. Unit tests (table, SiteSlide, SiteHome, glCover, facts) and e2e `site-cover-title-font.spec.ts`.

## Manual test scenarios

1. Library → open a default book → Preview: the cover title is Lora italic, ink as before.
2. Set the Title font to Sans → Preview: the cover title is the site sans, as before.
