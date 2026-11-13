# in-app-publish-core

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item in-app-publish-core

## Scope

- [ ] C1 `src/publish/publishSite.ts` (new, pure, injectable fetch / clock / sleep) per Designer Spec `shared/design/in-app-publish/spec.md` §3 and P4–P6: GET `_photobooks/publish-manifest.json` (404 → empty) → `planUpload` → PUT 4 in flight in plan order with a group barrier (assets → json → html) → deletes → manifest PUT last; P4 retry of network errors while online, 408, 429, 5xx and the 30 s per-request timeout (3 attempts, waits 1 s then 3 s), no retry on 403 / 404 / offline; P5 the partial manifest is written on failure and deletes only touch keys of the old manifest; P6 Cache-Control (content-hashed keys `public, max-age=31536000, immutable`, HTML / JSON / other `no-cache`, manifest `no-store`) and Content-Type from the extension; `publishSite.test.ts` (PBT where it fits) covers each
- [ ] C2 `src/publish/publish.worker.ts` + `createPublishWorker.ts`: `buildSiteTree` → `hashSiteFiles` → credentials loaded from IndexedDB inside the worker (P8: never posted to or from the page) → `publishSite` → hosting status record (P9: success → ok; `key` / `denied` / `bucket` → failed status so Settings → Hosting shows "Can't connect"); posts only `{phase: 'render' | 'upload' | 'finish', done, total}` ≥ 250 ms apart and one final redacted result; `importBoundary.test.ts` allows `publish.worker.ts` → `credentials.ts` and no other worker
- [ ] C3 `src/publish/r2Errors.ts` (new): `classifyR2Failure` + message builder extracted from `checkConnection.ts`; `r2Errors.test.ts`; `checkConnection.test.ts` unchanged and green
- **Done when:** all of the above green; CSP unchanged; Security Review before archive (credentials never leave the worker)
- **Perf:** N/A (no UI; all work runs in the worker, the page only creates it)
- **Browser check:** N/A (no UI; the prod Publish UI is `in-app-publish`)
- **Hard nos:** `src/publish/**` only; no edits to `src/editor/**`, `uikit/**`, `src/site/**`, `src/render/**`, `e2e/site-*`; no dependency changes; no real network in tests
- **Security:** token-leak surface (worker, `postMessage`, signed requests); Security Review before archive
