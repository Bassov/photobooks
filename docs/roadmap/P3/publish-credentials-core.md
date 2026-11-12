# publish-credentials-core

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item publish-credentials-core

## Scope

- [ ] PM1 `src/editor/hostingForm.ts` (new, pure): trim, normalise and validate the five Settings → Hosting fields with the Designer Spec messages (`shared/design/publish-credentials/spec.md` § Validation); Account ID also accepts the S3 endpoint URL (id lowercased, its bucket fills an empty Bucket); rejects `r2.dev`, `http:`, URLs with a path, EU / FedRAMP endpoints; property-based tests
- [ ] PM2 `src/publish/checkConnection.ts` (new): signed PUT, HEAD, DELETE of `_photobooks/check-<8 hex>.txt`, 15 s timeout, failures mapped per the Spec table (offline, CORS, bad key, access denied, missing bucket, timeout, other) through `redact`; credentials are saved only after a passing check; `src/publish/credentials.ts` gains `loadHostingSummary` (no secret), a status record (last result + time) and `forgetCredentials` (clears everything); unit tests with a mocked fetch pin that no summary, error, status or log string contains the secret
- [ ] PM3 `public/_headers`: `Content-Security-Policy` with `connect-src 'self' https://*.r2.cloudflarestorage.com`, `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; an e2e serves the app with that header, proves a fetch to another origin is blocked, an R2 fetch is not, and the app loads with no CSP violations
- **Done when:** all of the above green; PR body explains every CSP directive; Security Review before archive
- **Perf:** N/A (no UI, no hot path; the check runs only on Connect / Check again)
- **Browser check:** N/A for UI (the Hosting section UI is `publish-credentials`); the CSP e2e loads the welcome screen and the painter fixture editor
- **Hard nos:** no UI; no edits to `uikit/**`, `src/editor/SettingsScreen.tsx`, `src/editor/settingsScreenModel.ts`, `src/site/**`; no real network in tests; no new dependency
- **Security:** token-leak and CSP surface; Security Review before archive
