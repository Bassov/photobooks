# connect-own-hosting-core

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item connect-own-hosting-core
Status: done

## Scope

- [ ] Pure core of guided hosting setup in `src/publish/` (item 3 of 4 of `connect-own-hosting`; Owner Q-16 2026-11-14 13:22: setup through a relay on our Worker, 4 items: kit, relay, core, UI). Designer Spec `connect-own-hosting` § Core, § Relay last bullet (page client), C2, C7–C10.
- [ ] `src/publish/cfApi.ts`: `fetch('/api/cf/…', {headers: {Authorization}})`, 15 s timeout, errors mapped to codes, messages through `redact()`, which also scrubs 40+ char token-like runs.
- [ ] `src/publish/provision.ts`: `setupTemplateUrl()`, `discover(token)`, `bucketNameFor(host)`, `runSetup(plan, from)` (async iterator of row states, rows 1–6 of the Spec table, resumable), `deriveS3Keys(tokenId, tokenValue)` (WebCrypto SHA-256).
- [ ] `src/publish/credentials.ts`: record and summary get `origin: 'setup' | 'manual'`, `provisionedAtMs?`, `setupTokenLeft?`; a record without `origin` reads as manual (no migration, no backward compat).
- **Done when:** P1 the template URL test pins the decoded permission JSON (3 keys, source cited in the PR); `discover` returns accounts, active + pending zones, `r2On` (code 10042 → off) and buckets; `cfApi` maps errors per the Spec Step 1 table. P2 `bucketNameFor` PBT: always matches the bucket regex, deterministic, ≤ 63 (`books.basov.photo` → `pb-books-basov-photo`); `runSetup` resumes from each step without calling earlier rows, "already exists / attached" = done, row 5 retries Cors every 5 s up to 30 s, a row 6 failure stores the record with `setupTokenLeft`; `deriveS3Keys` = token id + SHA-256 hex of the value. P3 record fields round-trip; leak PBT: the setup token is never in IndexedDB, localStorage, the URL or logs after success, failure and cancel.
- **Browser check:** none (no UI; the relay is not on main, `cfApi` is tested with an injected fetch). The prod UI item runs the browser check.
- **Hard nos:** only `src/publish/**`; no `src/worker/**`, `wrangler.jsonc`, `uikit/**`, `src/editor/**`; no migration of stored records.
- **Test:** unit + PBT (`provision.test.ts`, `provision.pbt.test.ts`, `cfApi.test.ts`, `leakGuard.pbt.test.ts`).
- **Depends:** publisher-targets, publish-credentials
