## Decisions

1. One face table `src/render/coverTitleFace.ts` (`titleFont` → family / style / weight). CoverView sets it as `--cover-title-family` / `--cover-title-style` on `.cover-spread`; `CoverView.css` reads them and drops its `[data-title-font]` overrides. Same faces as before: `Lora Cover` and the existing `--font-sans` token, no new tokens.
2. `siteBookFacts` copies `cover.style.titleFont` (Preview, export, sample site). `siteTitleFace` gives the serif faces as inline style; `sans`, missing or unknown values return nothing, so `.ss .sd-it` (Site Inter Display 500) stays.
3. GL `frontPanel` draws with the same face; `book3dGl` loads it first. Spine keeps the site font.
4. Kit mirrors it (`features/site/titleFace.ts`; `SiteBook.titleFont?` defaults to `serif-italic`, the kit Title font default) in `CoverFace` and `coverCanvas`.
5. Ink untouched. `ui-review` runs before push.

## Touch-set & Test Plan

| File                                        | Why       |
| ------------------------------------------- | --------- |
| `src/render/coverTitleFace.ts`              | table     |
| `src/render/CoverView.tsx`                  | vars      |
| `src/render/CoverView.css`                  | read vars |
| `src/site/siteInput.ts`                     | fact      |
| `src/site/siteModel.ts`                     | copy      |
| `src/site/SiteSlide.tsx`                    | CoverFace |
| `src/site/book/Book3D.tsx`                  | cover     |
| `src/site/book/glCover.ts`                  | GL font   |
| `src/site/book/book3dGl.ts`                 | load      |
| `src/site/book/roomGl.ts`                   | load      |
| `uikit/src/features/site/titleFace.ts`      | kit table |
| `uikit/src/features/site/sample.ts`         | field     |
| `uikit/src/features/site/art.tsx`           | CoverFace |
| `uikit/src/features/site-book/gl/closed.ts` | canvas    |

Tests: unit table / site face incl. unknown value / SiteSlide / SiteHome / glCover; e2e `site-cover-title-font.spec.ts` (Preview computed face + paint, sans unchanged).
