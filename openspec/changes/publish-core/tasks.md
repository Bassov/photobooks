## Implementation

- [x] 1. `src/publish/r2Sign.ts`: generic SigV4 signer + `r2Request` (PUT / HEAD / DELETE); AWS vector tests — `r2Sign.test.ts` (7 AWS vectors: suite get-vanilla, query-order-key-case, post-vanilla; S3 GET range, PUT with body, `?lifecycle`, `?max-keys=2&prefix=J`)
- [x] 2. `src/publish/credentials.ts`: `R2Credentials`, `validateCredentials`, `redact`, IndexedDB store `photobooks-secrets`; unit tests — `credentials.test.ts`
- [x] 3. `src/publish/uploadPlan.ts`: `planUpload` + `hashSiteFiles`; PBT ≥200 runs + real-tree order test — `uploadPlan.pbt.test.ts` (300 runs)
- [x] 4. Leak guard PBT (≥200 runs) and import-boundary test (proved red by a temporary, uncommitted `src/site/**` import) — `leakGuard.pbt.test.ts` (200 runs), `importBoundary.test.ts` (failed with `import '../publish/credentials'` in `src/site/siteUrl.ts`, reverted)
- [x] 5. `docs/future-architecture.md` § Site host: Owner decision + Token safety list

## Manual test scenarios

N/A — no UI; behavior is covered by unit / PBT tests.
