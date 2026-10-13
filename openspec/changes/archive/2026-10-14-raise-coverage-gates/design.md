# Design

## Goals

- Hard Vitest coverage gate at **80%** (statements, branches, functions, lines); Codecov project target aligned.
- Include photo worker processing in the coverage denominator via a public, unit-testable API.
- Exclude only non-runtime noise: benches and `.d.ts`. Keep excluding `main.tsx` bootstrap.

## Non-goals

- 90% floors; Playwright counted in Vitest coverage; product UX changes.

## Approach

1. **Extract processing** from `photo.worker.ts` into public `src/photo/processPhoto.ts` exporting request/response types and `processPhotoRequest(request)`. Worker becomes thin: `onmessage` → process → `postMessage` (transfer `previewBuffer` on success).
2. **Unit-test** `processPhotoRequest` with real JPEG fixtures (`e2e/fixtures`) and mocks only at boundaries (`createImageBitmap`, `OffscreenCanvas`, `exifr` where needed).
3. **UI/orchestration/perf/schema tests** with `@testing-library/react` (devDependency only; no production CSP/runtime surface) on happy-dom. Cover observable states: idle Open-photo CTA; busy/loading label; success `PhotoCard` metadata (dimensions/aspect/size/preview); error alert. Files: `src/photo/PhotoCard.test.tsx`, `src/photo/useOpenPhoto.test.ts`, `src/App.test.tsx`, `src/perf/loafObserver.test.ts`, `src/perf/exposePerf.test.ts`, `src/photo/exifSchema.test.ts`. Mock `loadPhoto` / picker at module boundaries for hooks/App.
4. **Close gaps** in `loadPhoto` (failure/error/revoke), `pickPhoto` (non-Abort rethrow), `jpegSof` branches as needed.
5. **Raise gates** only after measured coverage ≥80%: update `vite.config.ts` exclude + thresholds, `codecov.yml` target `80%`, Stryker `mutate` to include `processPhoto.ts`.

## Touch-set

- `src/photo/processPhoto.ts` (new), `src/photo/photo.worker.ts`, `src/photo/processPhoto.test.ts`
- Tests: `PhotoCard`, `useOpenPhoto`, `App`, `loafObserver`, `exposePerf`, `exifSchema`, extend `loadPhoto`/`pickPhoto`/`jpegSof` tests
- Shared helpers if MockWorker/fixture factories duplicate
- `vite.config.ts`, `codecov.yml`, `stryker.config.json`, `package.json` (+ Testing Library)
- OpenSpec: this change + sync main `ci-gates` on archive

## Composition

- Domain processing stays pure-ish in `processPhoto` (no React); worker is I/O shell; UI hooks compose `loadPhoto`/`pickPhoto`.

## Tests (public API)

- Under test: `processPhotoRequest`, exported components/hooks/perf APIs, existing domain exports.
- Reuse: `e2e/fixtures/ensurePhotoFixtures`, extend MockWorker from `loadPhoto.test.ts` into a shared `*.test-helpers.ts` if duplicated.

## Security

- Tests must not weaken worker message contracts or invent privileged postMessage channels; blob URLs only via existing `loadPhoto`/`revokePhotoPreview`.
