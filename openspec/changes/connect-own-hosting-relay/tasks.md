## Implementation

- [x] 1. Worker tsconfig, `wrangler.jsonc` (main, ASSETS binding, `run_worker_first`, observability off), `knip.json` entry, `no-console` lint rule for `src/worker/**` — `tsconfig.worker.json`, `eslint.config.js`
- [x] 2. `src/worker/cfRelay.ts`: origin check, route allowlist, auth header, capped JSON bodies + schemas, DELETE verify, response headers — Stryker diff 100 %
- [x] 3. `src/worker/index.ts`: `/api/cf/*` → relay, else `ASSETS` — `cfRelay.test.ts` "worker entry"
- [x] 4. `src/worker/cfRelay.test.ts`: every R1/R2 branch + PBT over random paths/methods — "handleCfRelay is not an open proxy (R3 PBT)"
- [x] 5. `docs/future-architecture.md` Q-10 exception (Owner Q-16 quote); README hosting line

## Manual test scenarios

1. `wrangler dev`: a same-origin relay call with a dummy token; the log has no token value (redacted lines in the PR body). No UI.
   - OK: verify 401 relayed (only `Content-Type`, `Cache-Control: no-store`, `nosniff`); cross-origin 403; off-list 404; broadened token body 403; foreign token delete 403; `grep -c` of the token in the dev log and wrangler's own log = 0.
