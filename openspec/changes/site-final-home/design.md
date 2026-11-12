## Decisions

1. **CSS-first frame, JS case.** Name, lead and the case's x / width are CSS (desktop and `≤ 640px` phone), so the 1440×900 prerender holds at any width. After hydration `useViewport` gives the box; `SiteHome` computes scale, rows (`shelf.ts`, kit port) and case height, then unhides the case (D42).
2. **Lazy GL, CSS fallback.** `Book3D` prerenders the kit CSS book. After `load` + first idle a dynamic `book3dGl.ts` (outside `gl/`, so the entry probe holds) checks `glWanted()`, maps site data to `GlBookInput` (D38) and draws each face-out once into a canvas that replaces the CSS faces. One-shot, idle-deferred draws on the main thread are fine: no per-frame GL work, hover moves only CSS transforms; a failure keeps CSS.
3. **Fonts:** "Site Inter Display" faces live in `siteSystem.css` with root-absolute `/fonts/*opsz*` URLs; the export already copies CSS refs.
4. **Tokens:** `siteSystem.css` carries the kit's site tokens (`--bg`, `--ink`, `--grey`, `--line`, eases, `t13/t16/t24/m15/m19`): the site is a separate surface from the editor's Theme B in `docs/design.md`, owned by the kit's `system.css`. `ui-review` runs before push.

## Touch-set & Test Plan

| Path                                                  | Why                                |
| ----------------------------------------------------- | ---------------------------------- |
| `src/site/SiteHome.tsx`                               | home (new)                         |
| `src/site/SiteHome.test.tsx`                          | unit (new)                         |
| `src/site/shelf.ts`                                   | kit port (new)                     |
| `src/site/shelf.test.ts`                              | unit + PBT (new)                   |
| `src/site/book/Book3D.tsx`                            | CSS book + GL hook (new)           |
| `src/site/book/afterLoadIdle.ts`                      | load + idle gate (new)             |
| `src/site/book/afterLoadIdle.test.ts`                 | unit (new)                         |
| `src/site/book/book3dGl.ts`                           | lazy GL draw (new)                 |
| `src/site/book/book3dGl.test.ts`                      | D38 panels / input (new)           |
| `src/site/siteSystem.css`                             | tokens, type, case, book (new)     |
| `src/site/SiteCatalog.tsx`                            | deleted                            |
| `src/site/SiteApp.tsx`                                | routes home                        |
| `src/site/main.tsx`                                   | imports `siteSystem.css`           |
| `src/site/renderSitePage.tsx`                         | theme-color, noscript              |
| `src/site/renderSitePage.test.tsx`                    | home pins                          |
| `src/site/__snapshots__/renderSitePage.test.tsx.snap` | snapshot                           |
| `src/site/sampleShell.ts`                             | theme-color                        |
| `src/site/siteModel.ts`                               | drop catalog helpers               |
| `src/site/siteModel.test.ts`                          | drop catalog helper tests          |
| `src/site/SiteBookPage.test.tsx`                      | catalog tests move out             |
| `scripts/vite-site-viewer-manifest.mjs`               | preload opsz latin; lazy GL chunks |
| `scripts/vite-site-viewer-manifest.test.mjs`          | preload + lazy chunk pins          |
| `vite.config.ts`                                      | relative JS URLs (lazy chunks)     |
| `styles/tokens.css`                                   | `--ss-*` home tokens               |
| `src/site/export/buildSiteTree.test.ts`               | home index.html size               |
| `src/site/siteViewer.css`                             | drop catalog rules                 |
| `src/site/startSite.test.tsx`                         | home + theme pins                  |
| `site.html`                                           | preload opsz latin                 |
| `public/fonts/inter-latin-opsz-normal.woff2`          | D43                                |
| `public/fonts/inter-latin-ext-opsz-normal.woff2`      | D43                                |
| `public/fonts/inter-cyrillic-opsz-normal.woff2`       | D43                                |
| `e2e/site-final.spec.ts`                              | home checks (new)                  |
| `e2e/site-viewer.spec.ts`                             | home selectors                     |
| `e2e/static-export-viewer.spec.ts`                    | 12 woff2, Site Inter Display loads |

Export: the manifest copies the dynamic-import closure of the site entry (the home's GL books, three) unlinked, leaving out the sample shell and perf hooks; `renderBuiltUrl` makes JS-hosted URLs (lazy imports, their preload deps) relative to the importing chunk, so an exported site loads them under `viewer/`.

Tests: shelf PBT (each book once, rows fit `avail`); SiteHome unit (D37 head / lead, links, empty, laid flag); e2e checkpoints at three sizes, Cyrillic font, no shift, `?gl=0`, empty, hover perf.
