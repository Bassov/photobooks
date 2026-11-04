## Decisions

1. **Renderer contract.** `SitePageRenderer` becomes `(input, assets) => string`. `buildSiteTree` builds the Spec §6 input and defaults to `renderSitePage`; the placeholder goes. `ImageRef` uses the real webp preset widths (480 / 1600 / 3200), and `og:image` is `site-share`. `SiteExportInput.site?` sets the title (default `Photobooks`). The site-export requirement wording is unchanged.
2. **Privacy.** In `#site-data` each asset record is `{}` and the gallery is empty; keys are sorted and `<` is escaped.
3. **SSR + hydrate.** The first client render equals the server one: the stage is CSS-sized and the catalog columns use media queries. A layout effect then applies `stageWidth`, the book object height and the `#pN` hash (`replaceState`). Off-screen catalog cards get `content-visibility: auto`. The stage mounts only the current slide and its two neighbours (inert, opacity 0).
4. **Sample site** (needed for the Lighthouse and e2e audit of `/site.html`). Without `#site-data`, `site.html` lazy-loads `sampleSite.ts` (two books), renders it through `renderSitePage` and hydrates. `react-dom/server` lives in that lazy chunk only, never on an exported page's path. `?book=` picks the page; `?perf=1` loads the perf hooks.
5. Reuse `SpreadView`, `CoverView`, `BookObject`, `Icon` (+ `share`, `arrowLeft`) and the `styles/tokens.css` scales. `--site-*` lives in `styles/tokens.css` (css-tokens gate) and is documented in `docs/design.md`. Site code imports core modules directly, not the barrel, so zod stays out of the viewer entry. Pages = 2(n − 1) (kit).

## Touch-set & Test Plan

| Path                                  | Why                                 |
| ------------------------------------- | ----------------------------------- |
| `site.html`                           | entry                               |
| `vite.config.ts`                      | rollup input                        |
| `budget.json`                         | stricter `/site.html` budget (gate) |
| `quality/gates.json`                  | mirrored budget (gate)              |
| `styles/tokens.css`                   | `--site-*` tokens                   |
| `src/render/CoverView.tsx`            | direct `core/pages` import          |
| `src/site/siteModel.ts`               | pure model                          |
| `src/site/siteInput.ts`               | page input types                    |
| `src/site/SiteApp.tsx`                | page root                           |
| `src/site/SiteCatalog.tsx`            | catalog                             |
| `src/site/SiteBookPage.tsx`           | book page, keys, hash               |
| `src/site/SiteStage.tsx`              | stage, slides, swipe                |
| `src/site/ShareButton.tsx`            | Share                               |
| `src/site/useViewport.ts`             | measured layout                     |
| `src/site/site.css`                   | site styles                         |
| `src/site/renderSitePage.tsx`         | page renderer                       |
| `src/site/startSite.tsx`              | hydrate                             |
| `src/site/main.tsx`                   | entry                               |
| `src/site/sampleSite.ts`              | sample library                      |
| `src/site/sampleShell.ts`             | sample prerender                    |
| `src/site/export/buildSiteTree.ts`    | renderer adapter                    |
| `src/site/export/types.ts`            | renderer contract                   |
| `src/site/export/index.ts`            | exports                             |
| `src/site/export/defaultRenderer.tsx` | deleted placeholder                 |
| `src/ui/icons/glyphs.ts`              | glyphs                              |
| `src/ui/Icon.test.tsx`                | glyph list                          |
| `docs/design.md`                      | tokens                              |
| `e2e/site-viewer.spec.ts`             | e2e + perf                          |

Tests: model unit + PBT (1000 runs), renderer snapshot + determinism + privacy, Share / keys / swipe component tests, and e2e for the empty, happy and interact states. Run `ui-review` before push.
