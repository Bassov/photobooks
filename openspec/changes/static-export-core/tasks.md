## Implementation

- [x] 1. Types: export input, derivative input, page models, renderer, site file / tree (`src/site/export/types.ts`).
- [x] 2. Builder: published filter, asset + derivative selection, content-addressed paths, manifest, sorted tree, `missing` (`buildSiteTree.ts`; `buildSiteTree.test.ts` "reports missing derivatives…").
- [x] 3. Default renderer (title + spread images) and `renderToStaticMarkup` pages (`defaultRenderer.tsx`; inline snapshot in `buildSiteTree.test.ts`).
- [x] 4. Unit tests: inline snapshot + double export, throws, viewer copy, missing, custom renderer (`buildSiteTree.test.ts`, 15 tests).
- [x] 5. PBT (≥1000 runs): order independence, published-only / no draft leak, referenced files exist (`buildSiteTree.pbt.test.ts`).
- [x] 6. Main spec `openspec/specs/site-export/spec.md`.

## Manual test scenarios

N/A — no UI (prep); unit + PBT only.
