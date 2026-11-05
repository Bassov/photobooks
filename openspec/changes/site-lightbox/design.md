## Decisions

1. `SpreadPager` dispatches on `variant`: `presentation` renders today's code (moved verbatim to `PresentationPager` inside `SpreadPager.tsx`), `lightbox` renders the new `LightboxPager`; hooks stay unconditional and presentation untouched.
2. Each mounted slide is fitted with `pagerZoom.fitBox` + CSS `zoom`; the zoom layer is a `transform`-only wrapper.
3. Zoom state is per slide in `useLightboxZoom` (gestures, wheel, keys' zoom); a step keeps the old slide's zoom while it slides away.
4. `onZoomSettle(z, boxWidth)`: `SiteLightbox` grows photo `sizes` only upwards while open.
5. `SiteLightbox` owns its slide index; close → `show(i)`, focus back via `takeFocus`.
6. Tokens (styles/tokens.css): `--presentation*`, `--shadow-stage-dark`, `--site-control*`, `--site-focus`; no new ones. Glyphs `x`, `maximize2`.

## Touch-set & Test Plan

| File                                                  | Why                         |
| ----------------------------------------------------- | --------------------------- |
| `src/render/SpreadPager.tsx`                          | variant dispatch            |
| `src/render/LightboxPager.tsx`                        | lightbox variant            |
| `src/render/useLightboxZoom.ts`                       | gestures / zoom             |
| `src/render/hoverPointer.ts`                          | hover media query           |
| `src/render/SpreadPager.test.tsx`                     | lightbox block              |
| `src/render/LightboxPager.test.tsx`                   | gestures                    |
| `src/site/SiteLightbox.tsx`                           | site wrapper                |
| `src/site/SiteStage.tsx`                              | `SlideContent`, `site-open` |
| `src/site/siteModel.ts`                               | `slideSide` (moved)         |
| `src/site/export/buildSiteTree.test.ts`               | page byte sizes snapshot    |
| `src/ui/Icon.test.tsx`                                | glyph count                 |
| `src/site/SiteBookPage.tsx`                           | Fullscreen button           |
| `src/site/ShareButton.tsx`                            | shared action class         |
| `src/site/site.css`                                   | actions, overlay, slide     |
| `src/site/SiteBookPage.test.tsx`                      | open / close / sizes        |
| `src/site/__snapshots__/renderSitePage.test.tsx.snap` | button + overlay            |
| `src/ui/icons/glyphs.ts`                              | glyphs                      |
| `e2e/site-lightbox.spec.ts`                           | e2e + perf                  |

Reuse: `pagerZoom.ts`, `pagerIndex`, `focusTrap`, `slideLabel`. Unit: pager lightbox block, hook gestures. e2e: rects, keys, swipe, zoom anchor, pan clamp, touch, reduced motion, CPU ×4 perf gate. Skill `ui-review` before push.
