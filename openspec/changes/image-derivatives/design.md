## Decisions

1. **Presets are config** in `plan.ts` (WebP 480 / 1600 / 3200, JPEG 1600 share); long-edge fit, never upscale. Cache key `(assetHash, presetCacheId)` folds edge / format / quality in, so a config change misses.
2. **Pure plan**: `planDerivativeJobs` dedupes, keeps request order, presets in config order; `canStartDerivative` starts nothing while a decode job is queued (thumbs + editor tiers share that queue), a metadata job runs, the scroll-quiet window is open or the slot (1) is busy.
3. **Worker encode** (`encode.ts`): one `createImageBitmap` decode (`from-image` orientation), per preset a `resizeQuality: 'high'` bitmap on a `colorSpace: 'srgb'` `OffscreenCanvas` (JPEG on white), `convertToBlob`, SHA-256; buffers transfer back.
4. **Security**: the worker rejects requests whose preset id is not in config or whose source is not a `Blob`; no blob URLs, no network. Seam `window.__photobooksDerivatives` sits behind the literal `import.meta.env` check (as `exposeProjectSessionTestApi`); a unit test asserts it stays unset when the gate is off.
5. **Pool** (`pool.ts`): lazy worker, gate re-check every 250 ms while blocked; main thread only `has` / `postMessage` / `put`.

## Touch-set & Test Plan

| Path                                        | Why                                                 |
| ------------------------------------------- | --------------------------------------------------- |
| `src/derivatives/plan.ts`                   | presets, keys, plan, gate                           |
| `src/derivatives/encode.ts`                 | decode / resize / encode / hash                     |
| `src/derivatives/derivative.worker.ts`      | thin handler                                        |
| `src/derivatives/createDerivativeWorker.ts` | Stryker-safe factory                                |
| `src/derivatives/pool.ts`                   | queue, cache, seam                                  |
| `src/editor/projectSession.ts`              | installs seam (App.tsx is Stryker-excluded)         |
| `e2e/image-derivatives.spec.ts`             | functional + gate                                   |
| `package.json`                              | `perf` script lists the new spec                    |
| `scripts/perf-lane.mjs`                     | stricter: `src/derivatives/` triggers the perf lane |

- Tests: PBT on plan; encode with stubbed canvas; pool with mock worker + memory cache.
- e2e: functional describe (same hashes twice, cache hits, benchmark log) plus a `frame-budget gates` describe (4 s throttled drag while encoding → 0 LoAF).
