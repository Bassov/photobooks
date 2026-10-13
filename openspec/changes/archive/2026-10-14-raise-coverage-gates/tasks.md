# Tasks

## 1. Extract and test photo processing

- [x] 1.1 Add `src/photo/processPhoto.ts` with public `processPhotoRequest` + shared worker request/response types; thin `photo.worker.ts` to onmessage/postMessage
- [x] 1.2 Add `src/photo/processPhoto.test.ts` (fixtures + boundary mocks); cover success, failure, JPEG strip, size fallbacks
- [x] 1.3 Extract shared MockWorker / photo model factory into a test helper if loadPhoto tests duplicate it

## 2. UI, perf, schema unit tests

- [x] 2.1 Add `@testing-library/react` (and peer types if needed) as devDependencies
- [x] 2.2 `PhotoCard.test.tsx` — render model; assert dimensions, aspect, size, preview
- [x] 2.3 `useOpenPhoto.test.ts` — success, unsupported MIME, generic error, picker vs file-input, revoke
- [x] 2.4 `App.test.tsx` — idle CTA, busy, error alert, card when photo present
- [x] 2.5 `loafObserver.test.ts` + `exposePerf.test.ts`
- [x] 2.6 `exifSchema.test.ts` — valid / invalid parse

## 3. Domain gaps

- [x] 3.1 Extend `loadPhoto.test.ts` — worker ok:false, worker error event, revokePhotoPreview
- [x] 3.2 Extend `pickPhoto.test.ts` — non-AbortError rethrow
- [x] 3.3 Close remaining `jpegSof` branch gaps if still below contribution

## 4. Raise gates

- [x] 4.1 Confirm `pnpm test:coverage` ≥80% on all four metrics
- [x] 4.2 Update `vite.config.ts` exclude (benches, `.d.ts`; drop worker exclude) and thresholds 80×4
- [x] 4.3 Update `codecov.yml` project target to 80%
- [x] 4.4 Update `stryker.config.json` mutate list for `processPhoto.ts`

## 5. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no production UI/bundle change)
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another — N/A (module map still `src/photo/`)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive (pass: no medium+)
