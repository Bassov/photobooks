# Tasks

## 1. Dependencies and scaffolding

- [x] 1.1 Add `exifr` and `zod` dependencies; verify `pnpm install` succeeds and types resolve
- [x] 1.2 Create `src/photo/` module stubs (pure helpers, worker entry, types) and verify they typecheck empty

## 2. Pure photo helpers

- [x] 2.1 Implement `normalizeOrientation` for EXIF 1–8 with unit tests for all cases; verify tests pass
- [x] 2.2 Implement `aspectRatio` with unit + PBT (scale-invariant, positive); verify tests pass
- [x] 2.3 Implement `formatBytes` with boundary unit tests (KB/MB/GB thresholds); verify tests pass
- [x] 2.4 Implement MIME accept/reject gate (JPEG/PNG/WebP vs TIFF/other); verify unit tests pass
- [x] 2.5 Add `vitest bench` for orientation/aspect helpers; verify `pnpm bench` runs

## 3. Worker load path

- [x] 3.1 Implement photo worker: EXIF parse (Zod boundary), `createImageBitmap`/preview, return model fields; verify unit or worker integration test for happy path
- [x] 3.2 Implement `loadPhoto(file)` orchestration calling the worker; verify unsupported MIME rejects before worker work
- [x] 3.3 Wire Vite worker import so production/preview builds used by Playwright succeed

## 4. UI

- [x] 4.1 Add Open photo CTA, `showOpenFilePicker` when available, hidden `input[type=file]` with test id; verify smoke still shows brand
- [x] 4.2 Render photo card (preview, WxH, aspect, size) and unsupported-format error; verify component/unit or e2e coverage

## 5. LoAF hooks and e2e

- [x] 5.1 Start LoAF observer + expose `__photobooksPerf` when `?loaf=1` (keep DEV); verify flag path in preview
- [x] 5.2 Add small EXIF JPEG fixture (Orientation=6) under `e2e/fixtures/`; Playwright asserts swapped corrected dimensions + PNG metadata path
- [x] 5.3 Add 24MP fixture generator script; Playwright LoAF scenario imports it and asserts `blockingDuration` ≤ 200 ms

## 6. Integration check

- [x] 6.1 Run full local verification checklist below and fix failures until green

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive

## Workflow follow-up

- Archive the change after implementation-reviewer passes.
- Open PR and confirm GitHub checks (`checks`, `integration`, `lighthouse`, `stryker-diff`) are green.
