## Implementation

- [x] 1. `coverTitleFace` table; CoverView reads it through CSS vars (no editor visual change). — `src/render/coverTitleFace.test.ts`, `CoverView.test.tsx` "hands the title its Title font face"
- [x] 2. `SiteBookFacts.titleFont`; site `CoverFace` and `Book3D` cover title use the face (sans keeps the site sans). — `SiteSlide.test.tsx`, `SiteHome.test.tsx`, `siteModel.book.test.ts`
- [x] 3. GL front panel font from the face; `book3dGl` / `roomGl` load it. — `book3dGl.test.ts`, `roomGl.test.ts`
- [x] 4. Kit: `titleFace`, `SiteBook.titleFont?`, `CoverFace` and `coverCanvas`. — e2e kit `#/demo` Preview test
- [x] 5. Unit tests (table, SiteSlide, SiteHome, glCover, facts) and e2e `site-cover-title-font.spec.ts`.

## Manual test scenarios

1. Library → open a default book → Preview: the cover title is Lora italic, ink as before.
2. Set the Title font to Sans → Preview: the cover title is the site sans, as before.

manual-qa (2026-11-20): problem (harness) — both scenarios blocked at the welcome screen (`start-session` click intercepted by the welcome header), not a product failure. Covered by e2e `site-cover-title-font.spec.ts` (Preview: Lora Cover italic 400, then sans → Site Inter Display 500 upright, title band paint differs; kit `#/demo` Preview: Lora italic 400), passed locally.
ui-review: pass — no chrome / token / state change; the front title reuses the editor cover face; ink unchanged.
