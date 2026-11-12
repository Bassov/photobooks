# publish-core

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item publish-core
Status: done

## Scope

- [ ] `src/publish/r2Sign.ts`: AWS SigV4 for the R2 S3 endpoint (`https://<accountId>.r2.cloudflarestorage.com/<bucket>/<key>`, region `auto`, service `s3`) on `crypto.subtle`; PUT / HEAD / DELETE; unit tests against official AWS SigV4 test vectors (≥5, incl. a PUT with body and a query-string case), no network
- [ ] `src/publish/credentials.ts`: `R2Credentials { accountId, bucket, accessKeyId, secretAccessKey, publicBaseUrl }`, pure `validateCredentials` (formats, https public URL, no whitespace), `redact()` for error messages, store in editor-origin IndexedDB only (own DB `photobooks-secrets`) — never in the library folder, project/book files, localStorage, URL or exported data; no logging of any field except `accountId` / `bucket`
- [ ] `src/publish/uploadPlan.ts`: pure plan from the `buildSiteTree` output + remote manifest (`key → sha256`): changed/new hashed assets, then JSON, then HTML, then deletes of removed keys; PBT ≥200 runs (changed set exact, HTML after every asset it references)
- [ ] Leak guards: PBT ≥200 runs — a random token set in the store never appears in any site export file (raw, base64, URL-encoded); static test — no `src/site/**` module or site viewer entry imports `src/publish/credentials` (proved by a temporary local edit, not committed)
- [ ] `docs/future-architecture.md` § Site host: Owner decision (Q-10, 2026-11-12) + «Token safety» list
- **Done when:** all of the above green; no new dependency in `package.json`; no UI changes
- **Owner quote (Q-10, 2026-11-12):** «По хостингу я бы хотел cloudflare использовать, сайт и картинки статикой. Чтобы картинки быстро грузились. Хочется чтобы настройка была минимальная, может записать токен cf в настройках библиотеки и все. Тут важно чтобы не было уязвимостей с утечкой токена в перс сайт или чтобы можно было как-то увести токен с редактора».
- **Perf:** N/A (no UI, no hot path; signing runs only at publish time)
- **Browser check:** N/A (no UI; `publish-credentials` / `in-app-publish` add the UI)
- **Hard nos:** no real network calls or Cloudflare access in tests; no edits to `uikit/**`, `src/site/**` (read only), `src/editor/**`
- **Test:** unit + PBT (Vitest, fake-indexeddb as already used by the repo)
- **Security:** token-leak guards above; Security Review before archive
