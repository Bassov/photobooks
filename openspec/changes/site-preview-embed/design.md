## Decisions

1. `SiteBookPage` props `embedded?: { slide; onSlide }`, `allBooks = true`, `share = true`, `renderSlide?`. Embedded: slide = `embedded.slide`, `show` calls `onSlide`; no hash or window key listeners.
2. `renderSlide(slide, widthPx)` replaces `<SlideContent>` in `SiteStage` (at the stage width) and `SiteLightbox` (at `STAGE_MAX`); the lightbox wrapper div (`site-lb-slide`) keeps.
3. `stageWidth({ vw, vh, ratio, allBooks = true })`: `ALL_BOOKS_H = 36` (32 link + 4 gap) subtracted from the chrome when false.
4. `useViewport(ref, { height: 'element' })`: `vh = el.clientHeight`; default `'window'` keeps `documentElement.clientHeight`.
5. `site.css` = Tailwind layers, `@source`, tokens, `html, body`, then `@import './siteViewer.css'`; `siteViewer.css` = every rule from `.site {` on, byte-unchanged.

## Touch-set & Test Plan

| File                                      | Why                                       |
| ----------------------------------------- | ----------------------------------------- |
| `src/site/SiteBookPage.tsx`               | embedded / allBooks / share / renderSlide |
| `src/site/SiteStage.tsx`                  | renderSlide                               |
| `src/site/SiteLightbox.tsx`               | renderSlide                               |
| `src/site/siteModel.ts`                   | `stageWidth` allBooks                     |
| `src/site/useViewport.ts`                 | element height                            |
| `src/site/site.css`                       | split                                     |
| `src/site/siteViewer.css`                 | split (new)                               |
| `src/site/SiteBookPage.embedded.test.tsx` | new unit tests                            |
| `src/site/siteModel.test.ts`              | allBooks values                           |
| `src/site/siteModel.pbt.test.ts`          | allBooks PBT                              |
| `src/site/useViewport.test.tsx`           | element height                            |
| `openspec/specs/site-viewer/spec.md`      | delta sync                                |

- Reuse: `SlideContent` default, `stageWidth` chrome constants.
- Unit: embedded controlled slide, no `replaceState`, no `hashchange`/`keydown` listener on window, Share / All books hidden, `renderSlide` on stage + lightbox; `stageWidth` 262.85 / 258.85 chrome boundaries; PBT allBooks:false ≥ allBooks:true, ≤ 760.
- e2e: `site-viewer`, `site-lightbox` unchanged; snapshot unchanged.
