## Implementation

- [ ] 1. `src/derivatives/plan.ts`: presets config, `resolvePreset`, `derivativeSize`, `presetCacheId`, `planDerivativeJobs`, `canStartDerivative` + unit / PBT tests.
- [ ] 2. `src/derivatives/encode.ts` + `derivative.worker.ts` + `createDerivativeWorker.ts`: one decode, per-preset sRGB resize / encode / SHA-256; tests with stubbed canvas APIs.
- [ ] 3. `src/derivatives/pool.ts`: lazy 1-worker pool, gate on decode queue / metadata / scroll-quiet, `DerivedCache` hit / put, results with `ms` / `cacheHit` / `outputHash`; test seam from `exposeProjectSessionTestApi`; tests with a mock worker.
- [ ] 4. `e2e/image-derivatives.spec.ts`: functional determinism + cache-hit + benchmark log; frame-budget gate (drag while encoding → 0 LoAF).

## Manual test scenarios

N/A — no UI; the e2e functional test and frame-budget gate drive the pipeline in Chromium.
