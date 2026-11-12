# site-final-home

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item site-final-home

## Scope

Source: Designer Spec `personal-site/spec.md` D37, D38, D42, D43, "Prod changes" P4 and the home checkpoints of "Spec (kit and prod, one design)" (Owner 2026-11-11: rework the prod personal site to the bookcase). The prod home becomes the kit's bookcase (`uikit/src/features/site/{home.tsx,shelf.ts,home.css,system.css}`, `uikit/src/features/site-book/book3d*`), fed by the P2 site data and the P3 GL renderer.

- [ ] `src/site/SiteHome.tsx` (replaces `SiteCatalog.tsx`) + `src/site/shelf.ts` (port of the kit `shelf.ts`): the bookcase, books as `<a href>` to their book pages; head = `author`, else the site title; lead = `intro`, else `Photobooks by {author}.`, else none (D37); no "All books" on the home.
- [ ] `src/site/book/Book3D.tsx`: the kit's CSS closed book; the GL book (`src/site/book/gl/**`) loads on the first idle after `load` and replaces the CSS objects in place; no WebGL2 / `?gl=0` keeps CSS. Site data → `GlBookInput` per D38.
- [ ] `src/site/siteSystem.css`: kit tokens, type, case and book CSS for the home; `site.css` / `siteViewer.css` stay for the book page until site-final-room.
- [ ] `public/fonts/inter-{latin,latin-ext,cyrillic}-opsz-normal.woff2` + `@font-face` "Site Inter Display" (D43).
- [ ] `src/site/renderSitePage.tsx`: home bg / theme-color `#f4f3f0`, prerender at 1440×900 with the case hidden until the first client layout (D42), noscript links.
- **Done when:** the home matches the Spec checkpoints at 1440×900, 1920×1080 and 390×844 (DOM measurements, a paint check of the case / books); `e2e/site-final.spec.ts`: Cyrillic name in Site Inter Display, books are links, no layout shift after client layout, `?gl=0` keeps CSS books; unit + changed e2e green; typecheck, lint, knip green; the site entry stays ≤ 200 KB with three only in the lazy chunk.
- **Hard nos:** no edits to `uikit/**`, `.github/workflows/pr-policy.yml`, `SiteBookPage*.tsx` (except moving the catalog tests out of `SiteBookPage.test.tsx`), `SiteStage.tsx`, `src/site/book/{reader,slides,turn}*`, `src/editor/SitePreview*.tsx`; `src/site/book/gl/**` only for a small export. No backward compat.
- **Perf:** home hover ≥ 58 fps median, zero LoAF > 50 ms from our code; PERF_BUDGETS unchanged.
- **Browser check:** `/site.html` at 1440×900 and 390×844: the name, the lead and the bookcase with the face-out GL book; hover lifts a book; a click opens its book page.
