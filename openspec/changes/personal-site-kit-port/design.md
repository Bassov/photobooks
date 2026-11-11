## Decisions

1. Verbatim copy (D35); hand edits only: `final` + always-false `fold`, Books switch, test ids, font-face.
2. `site-demo-1/v2.tsx` is not ported: `useBox` / `reduced` → `site-book/box.ts`, `metaOf` → `site/sample.ts`; its `site.css` (`sd-*` reader classes) → `site/base.css`.
3. `kit/router.ts` strips `?…` from full / feature ids. The scenario strip sets the count through `BooksCount` context, leaving the hash alone.
4. Fonts: Inter opsz woff2 ×3 subsets from `@fontsource-variable/inter` 5.3.0.
5. Tokens: the site's own paper palette (D34; a published site, not editor chrome); qa hue scan skips the sample cloth colours. `ui-review` before push.
6. GL canvases stay on the main thread: kit-only port, no prod path.

## Touch-set & Test Plan

| Path                                      | Why                |
| ----------------------------------------- | ------------------ |
| `uikit/src/features/site-book/box.ts`     | useBox             |
| `uikit/src/features/site-book/many.ts`    | BooksCount         |
| `uikit/src/features/site-book/room.tsx`   | final, test ids    |
| `uikit/src/features/site-book/slides.tsx` | fold               |
| `uikit/src/features/site-book/turn.tsx`   | fold               |
| `uikit/src/features/site-book/gl/curl.ts` | fold               |
| `uikit/src/features/site/sys.tsx`         | final, switch, ids |
| `uikit/src/features/site/home.tsx`        | PersonalSite       |
| `uikit/src/features/site/system.css`      | font-face          |
| `uikit/src/features/site/base.css`        | Lora removed       |
| `uikit/src/features/site/sample.ts`       | metaOf             |
| `uikit/src/kit/router.ts`                 | query split        |
| `uikit/src/kit/pages.json`                | entry              |
| `uikit/src/features/pages.tsx`            | page               |
| `uikit/scripts/qa.mjs`                    | hue scan           |
| `e2e/kit-personal-site.spec.ts`           | home               |
| `e2e/kit-personal-site-room.spec.ts`      | room               |
| `e2e/kit-personal-site-reader-gl.spec.ts` | GL reader          |
| `e2e/kit-personal-site-gl.spec.ts`        | `?gl=0`            |
| `e2e/fixtures/animationsSettled.ts`       | helper             |

Other `site-book/**`, `site/**`, `fonts/*`: verbatim. No unit tests (kit).
