## Decisions

1. **Generic signer:** one SigV4 header signer (any method / region / service), so the AWS vectors exercise the same code path the R2 wrapper (region `auto`, service `s3`) uses. S3 URI encoding, no double encoding.
2. **Secrets DB:** credentials live in a separate IndexedDB `photobooks-secrets` (one record); `load` re-validates, `save` validates first; validation errors name fields, never values. No other storage path exists.
3. **Redaction:** key id and secret are hidden in raw, URL-encoded and base64 forms.
4. **Plan order:** changed puts by kind — assets, JSON, HTML — then remote-only deletes; all non-HTML before HTML means every page's references exist before it.
5. **Thread:** hashing and signing use async `crypto.subtle` (off-thread in the browser); worker placement of the upload loop is `in-app-publish`.

## Touch-set & Test Plan

| File                                 | Why                       |
| ------------------------------------ | ------------------------- |
| `src/publish/r2Sign.ts`              | SigV4 + R2 request        |
| `src/publish/credentials.ts`         | validate, store, redact   |
| `src/publish/uploadPlan.ts`          | plan + hashing            |
| `src/publish/index.ts`               | barrel                    |
| `src/publish/r2Sign.test.ts`         | ≥5 AWS vectors            |
| `src/publish/credentials.test.ts`    | validation, store, redact |
| `src/publish/uploadPlan.pbt.test.ts` | ≥200 runs + real tree     |
| `src/publish/leakGuard.pbt.test.ts`  | ≥200 runs, export bytes   |
| `src/publish/importBoundary.test.ts` | viewer import closure     |
| `openspec/specs/publish/spec.md`     | via delta                 |
| `docs/future-architecture.md`        | decision + token safety   |
| `docs/roadmap/P3/publish-core.md`    | stub filled               |

Reuse: `siteExport.test-helpers.ts`, `memorySiteDirectory.test-helpers.ts` (read only), `fake-indexeddb`. No e2e (no UI).
