## Implementation

- [x] 1. `MiniSpread` `page?: "l" | "r"`: clip to that page, no centre fold (8c762ea1).
- [x] 2. `SiteViewer` first slide `page="r"`, last slide `page="l"`; drop the wrapper clip (8c762ea1).
- [x] 3. `e2e/kit-preview-fold-strip.spec.ts`: paint probe of slide 1 left edge, last slide right edge, lightbox slide 1, two-page fold kept (red before the fix: column 0 = rgb 229 on all rows, stage and lightbox; 2 passed after).

## Manual test scenarios

1. `#/demo` → create a book → Preview → →: Page 1's left edge shows no grey strip; → shows Pages 2–3 with the centre hairline; End: the last page's right edge is clean; Fullscreen on Page 1: no strip.

- OK: scenario 1 walked by `e2e/kit-preview-fold-strip.spec.ts` (Playwright on `/uikit/#/demo`, paint pixels); `pnpm agent manual-qa` drives only the prod editor, not the kit.
- OK: `pnpm uikit:qa:quick` 422 passed, 0 failed, 0 console errors (site-preview checks included).
- OK: `#/demo` walk main vs branch (80 steps): only step 31 differs, by the "Pages 2–3 duplicated" toast fade (timing); no step shows Preview slide 1, the spread-list Page 1 thumbnail is unchanged.
