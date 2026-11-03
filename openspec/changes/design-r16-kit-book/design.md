## Decisions

1. Endpaper caption: `PageLabels` (viewport.tsx) gives the endpaper node `pt-2`; cover / master keep `pt-2.5` (the KS3 qa lock on the cover's 10 px stays).
2. Endpaper spine: `EndpaperSpread` (v7.tsx) drops the shared `Gutter` gradient for prod's `.endpaper-gutter` line: absolute, inset-y 0, left 50 %, 1 px, `color-mix(in srgb, black 18%, transparent)`, also in the list thumbnail (prod renders it in the mini). `Gutter` stays for masters. The colour is a prod-parity literal, kit-local like the `Gutter` colours it replaces; no `docs/design.md` token applies.
3. Cover thumb: add `shrink-0` to the `h-13 w-10.5` thumb; the brief's 42 × 42 is read as 42 wide (prod `.cover-thumb` is 52 tall).

## Touch-set & Test Plan

| Path                             | Why                                                |
| -------------------------------- | -------------------------------------------------- |
| `uikit/src/sandbox/viewport.tsx` | endpaper caption offset                            |
| `uikit/src/sandbox/v7.tsx`       | endpaper spine line, cover thumb `shrink-0`        |
| `uikit/scripts/qa.mjs`           | append M89–M91 assertions to the kit-sync W4 block |

- Reuse: the W4 block's `#/demo` cover / endpaper selection and `textBox` helper.
- Tests: kit qa (Playwright on `#/demo`, 1440 × 900) asserts one value per roadmap number. No unit / PBT (no domain code).
