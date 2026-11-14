## Decisions

1. `createCfApi(token, deps)` → `request(method, path, body?)` returns `{ok: true, result}` or `{ok: false, code, status?, cfCode?, message}`; codes `offline | timeout | token | forbidden | r2-off | conflict | other`. Callers read the code per call (verify `forbidden` = token rejected; a probe `forbidden` = that permission missing). Request shapes follow the Cloudflare v4 API (relay not on main: injected fetch in tests).
2. `redact` also replaces 40+ char `[A-Za-z0-9_+/-]` runs holding an uppercase letter or `_+` (tokens, base64; `=` stays a separator); lowercase bucket names and hex ids stay readable.
3. `runSetup(plan, from = 1)` yields row states; each row is idempotent ("already exists / attached" checked by listing = done), resumable, never rolled back. Keys from row 4 live in `plan.memory`; resuming at 5–6 without them restarts at 4. The record is saved once, after row 6, with provenance. An abort signal stops before the next call.
4. Store: `save(credentials, provenance = {origin: 'manual'})` writes one IDB value; `load()` stays the five fields; `loadProvenance()` reads absent `origin` as manual. `HostingSummary` gets the three fields, typed optional so off-lane `src/editor` literals compile; `loadHostingSummary` always sets `origin`.

## Touch-set & Test Plan

| File                                         |
| -------------------------------------------- |
| `src/publish/cfApi.ts`                       |
| `src/publish/cfApi.test.ts`                  |
| `src/publish/provision.ts`                   |
| `src/publish/provision.test.ts`              |
| `src/publish/provision.pbt.test.ts`          |
| `src/publish/credentials.ts`                 |
| `src/publish/credentials.test.ts`            |
| `src/publish/checkConnection.test.ts`        |
| `src/publish/leakGuard.pbt.test.ts`          |
| `src/publish/fakeCloudflare.test-helpers.ts` |
| `src/publish/publishSite.ts`                 |

- Reuse: `checkConnection`, `sha256Hex`, `BUCKET_PATTERN`, `createFakeR2`.
- Tests: cfApi mapping; discover; resume from each row; Cors retry (fake timers); bucket-name PBT; leak PBT after success, failure and cancel. No e2e (no UI).
