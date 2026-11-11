## Decisions

1. Kit-only route `#/guide[/<id>]` + KitBar "Guide" link; TOC clicks use `history.replaceState`, so the page never remounts.
2. Copy is data (`content.ts`); the feature index maps `MANIFEST`, so an unmapped kit page fails QA.
3. `saddleSheets(pages)` is a pure function; the panel only renders it.
4. `capture(out, { dpr })` defaults to 1, so `#/demo` captures stay identical; `guide-shots.mjs` reuses the same walk.
5. Kit tokens only (`bg-field`, `bg-sel`, `bg-accent`, `border-border`, `text-muted-foreground`); no new tokens.

## Touch-set & Test Plan

| Path                                 | Why            |
| ------------------------------------ | -------------- |
| `uikit/src/kit/router.ts`            | route          |
| `uikit/src/kit/Shell.tsx`            | Guide link     |
| `uikit/src/main.tsx`                 | route + title  |
| `uikit/src/kit/guide/GuidePage.tsx`  | page           |
| `uikit/src/kit/guide/content.ts`     | copy           |
| `uikit/src/kit/guide/imposition.ts`  | `saddleSheets` |
| `uikit/src/kit/guide/Imposition.tsx` | panel          |
| `uikit/src/kit/guide/shots.json`     | callouts       |
| `uikit/src/kit/guide/Rich.tsx`       | inline markup  |
| `uikit/scripts/demo-capture.mjs`     | `dpr`          |
| `uikit/scripts/guide-shots.mjs`      | screenshots    |
| `uikit/scripts/guide-qa.mjs`         | QA             |
| `uikit/scripts/qa.mjs`               | link whitelist |
| `uikit/package.json`                 | scripts        |
| `uikit/public/guide/`                | images         |

Reuse: `KitBar`, `Segmented`, `Kbd`, `MANIFEST`, `capture()`. Tests: `guide-qa.mjs` covers the Spec QA list; `#/demo` before/after capture = 0 changed steps.
