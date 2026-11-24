## Decisions

1. Route `{ name: "guide"; chapter?: string }` (`#/guide`, `#/guide/<chapter>`) + `href.guide()`; `main.tsx` dispatches it with the title "Walkthrough · Photobooks UI kit".
2. KitBar "Walkthrough" (`data-nav="guide"`) is a react-aria `Link` with `onPress` and no `href`. The frozen qa.mjs "index links resolve" whitelist would fail on an `a[href="#/guide"]` on the index.
3. The #565 guide modules are the base, recoloured with theme tokens (`foreground`, `paper`, `field`, `sel`, `neutral-400`) and kit primitives (`navLink`, `Segmented`, `Kbd`). The copy is updated to main. `ui-review` applies.
4. `guide-shots.mjs` gets DPR 2 through CDP inside `capture()`'s existing `probe` hook; `demo-capture.mjs` is untouched.

## Touch-set & Test Plan

| Path                                  |
| ------------------------------------- |
| `uikit/src/kit/router.ts`             |
| `uikit/src/kit/Shell.tsx`             |
| `uikit/src/main.tsx`                  |
| `uikit/src/kit/guide/GuidePage.tsx`   |
| `uikit/src/kit/guide/content.ts`      |
| `uikit/src/kit/guide/Rich.tsx`        |
| `uikit/src/kit/guide/Imposition.tsx`  |
| `uikit/src/kit/guide/imposition.ts`   |
| `uikit/src/kit/guide/shots.json`      |
| `uikit/scripts/guide-shots.mjs`       |
| `uikit/package.json`                  |
| `e2e/kit-guide.spec.ts`               |
| `docs/roadmap/P5/walkthrough-port.md` |

The 20 binary figures `uikit/public/guide/<chapter>.jpg` are left out of the table and out of the reviewer diff.

Tests (`e2e/kit-guide.spec.ts`):

- the nav item is painted, current on the guide, and opens by click and by Enter;
- 21 chapters + 22 TOC links;
- every figure is decoded and painted;
- every `#/…` link resolves;
- TOC and deep links land under the bar;
- 2-up / 4-up sheets;
- kit `imposition()` equals prod.
