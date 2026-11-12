## Decisions

1. `hostingForm.ts` is pure (Spec rules); the store's `validateCredentials` stays the looser load-boundary check.
2. One `AbortController` + 15 s timer covers PUT → HEAD → DELETE; a failed HEAD still tries the DELETE. Only the XML `<Code>` (`[A-Za-z0-9]`) is read.
3. Status `{checkedAtMs, ok, code?, message?}` lives in the `photobooks-secrets` store under key `status`. `forgetCredentials` clears the object store and replaces `clear`.
4. Security: no module outside `src/publish/` may call `createCredentialStore` (static test); deps are injected; nothing logs.
5. CSP: `connect-src` self + R2 (the only fetch is the same-origin viewer bundle), `script-src 'self'` (no inline script or wasm), `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; no `default-src`. Vite preview stays unchanged; the e2e adds the parsed `_headers` via `page.route`.
6. Zod's caught `new Function` probe is a `script-src` violation: `src/lib/zod.ts` sets `jitless` and is the only `zod` import (guard test).

## Touch-set & Test Plan

| Path                                          | Why       |
| --------------------------------------------- | --------- |
| `src/editor/hostingForm.ts`                   | PM1       |
| `src/editor/hostingForm.pbt.test.ts`          | PM1 tests |
| `src/publish/checkConnection.ts`              | PM2       |
| `src/publish/checkConnection.test.ts`         | PM2 tests |
| `src/publish/credentials.ts`                  | PM2 store |
| `src/publish/credentials.test.ts`             | PM2 tests |
| `src/publish/importBoundary.test.ts`          | boundary  |
| `src/lib/zod.ts`                              | D6        |
| `src/lib/zod.test.ts`                         | D6 test   |
| `src/core/schema.ts`                          | D6 import |
| `src/core/print/profileSchema.ts`             | D6 import |
| `src/photo/exifSchema.ts`                     | D6 import |
| `src/project/libraryDocument.ts`              | D6 import |
| `public/_headers`                             | PM3       |
| `e2e/csp-connect.spec.ts`                     | PM3 test  |
| `docs/roadmap/P3/publish-credentials-core.md` | item      |

Reuse: `r2Request`, `redact`, `BUCKET_PATTERN`, `fake-indexeddb`, `@fast-check/vitest`, e2e `openFixture`.
