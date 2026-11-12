## Decisions

1. The room owns Share and Fullscreen (D36) in Play's existing containers, so the K1 geometry holds; phones get Share only.
2. Fullscreen reuses `Fullscreen` from `site-viewer.tsx` (import only); slide s = room view s + 1.
3. `SysSite` takes optional `books`, `start` (open book / view / lightbox) and `roomRef` (key API); this keeps the `site-lightbox` / `site-viewer` kit scenarios.
4. `siteBooks.ts` has no imports (structural types, template ids passed in), so its unit test runs in Playwright's Node runner.
5. The Preview's document-capture key guard forwards unmodified ← / → / Home / End to `roomRef`; the editor never sees them.
6. UI: the stand's text-button primitives (`t16` / `m15`, `g`, `ss-tx`, `--grey` / `--ink`) and the kit lightbox; no new tokens. e2e covers empty / happy / interact; skill `ui-review` before push.

## Touch-set & Test Plan

| File                                    |
| --------------------------------------- |
| `uikit/src/features/site-book/room.tsx` |
| `uikit/src/features/site-book/room.css` |
| `uikit/src/features/site/sys.tsx`       |
| `uikit/src/features/site/home.tsx`      |
| `uikit/src/features/site/sample.ts`     |
| `uikit/src/demo-parts/siteBooks.ts`     |
| `uikit/src/demo-parts/site.tsx`         |
| `uikit/src/demo-parts/index.ts`         |
| `uikit/src/features/pages.tsx`          |
| `uikit/scripts/demo-capture.mjs`        |
| `uikit/scripts/qa.mjs`                  |
| `e2e/kit-personal-site-share.spec.ts`   |
| `e2e/kit-personal-site-demo.spec.ts`    |
| `e2e/kit-personal-site-books.spec.ts`   |
| `e2e/kit-preview-fold-strip.spec.ts`    |
| `e2e/kit-personal-site.spec.ts`         |
| `e2e/kit-preview-mod-arrows.spec.ts`    |

Reuse: `Fullscreen`, `SpreadArt` / `TitlePage` / `ENDPAPER`, `pixelsAt`.
