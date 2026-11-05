## Implementation

- [x] 1. Lab metrics + fixtures: luma SSIM, 16 px block band step, generated sky / shadows / foliage rasters (`src/derivatives/lab/`), unit tests (`metrics.test.ts`, `fixtures.test.ts`).
- [x] 2. Lab candidates (1600 / 2048 / 3200 × WebP 0.75–0.90 × JPEG 0.80–0.90), thresholds, per-edge pick and markdown table, unit tests (`candidates.test.ts`).
- [x] 3. Lab worker (reuses `encodePreset`) and dev page `dev/derivative-lab.html`, test-build input only (`runLab.test.ts`, `lab.worker.test.ts`, `labPage.test.ts`, `main.test.ts`; deploy `vite build` has no lab output).
- [x] 4. e2e `e2e/derivative-lab.spec.ts`: all 63 variants decode (naturalWidth > 0), no page-level scroll, table written to the test output dir for the PR body.
- [x] 5. Chosen presets in `src/derivatives/plan.ts` + `image-derivatives` spec; `plan.test.ts` / `encode.test.ts` / `pool.test.ts` cache ids.

## Manual test scenarios

1. Open `/dev/derivative-lab.html` in dev: three fixture sections, 63 variants, each with bytes, SSIM and band step; the picks list names one quality (or none) per edge and format.
