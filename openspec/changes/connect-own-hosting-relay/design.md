## Decisions

1. `handleCfRelay(request, upstream)` is pure over an injected `fetch`; `index.ts` routes `/api/cf/*` to it, else `env.ASSETS`. Order: origin (403) → allowlist (404) → Bearer token (401) → body (403 / 413 / 415) → forward to a URL rebuilt from matched parts.
2. Bodies: capped read, `JSON.parse`, closed schemas (spec), re-serialized before forwarding. Bucket Item Write id `2efd5506f9c8494dacb1fa10a3e7d5b6` (Cloudflare R2 docs), pinned in a constant.
3. `DELETE /user/tokens/:id`: the relay's own verify call with the same token must return `:id`.
4. Responses: only `Content-Type` kept, plus `Cache-Control: no-store`; fixed error codes, nothing echoed; `redirect: 'manual'` (workerd has no `'error'`; a 3xx returns unfollowed); `observability.enabled: false`; `no-console` lint.
5. No new deps: `tsconfig.worker.json` (WebWorker lib) owns `src/worker`; a local `Env` type.

## Touch-set & Test Plan

| Path                          | Why                                               |
| ----------------------------- | ------------------------------------------------- |
| `src/worker/index.ts`         | entry                                             |
| `src/worker/cfRelay.ts`       | relay                                             |
| `src/worker/cfRelay.test.ts`  | tests                                             |
| `wrangler.jsonc`              | main, ASSETS, run_worker_first, observability off |
| `tsconfig.worker.json`        | worker lib                                        |
| `tsconfig.json`               | `references` + worker                             |
| `tsconfig.app.json`           | `exclude` worker                                  |
| `knip.json`                   | `entry`                                           |
| `eslint.config.js`            | stricter: `no-console`                            |
| `docs/future-architecture.md` | Q-10 exception                                    |
| `README.md`                   | hosting line                                      |

Tests (node env): origin 403s; route 404s; PBT random method/path → never forwarded unless allowlisted; broader token bodies → 403; CORS origins; size / type / JSON; DELETE verify; header strip; upstream throw → 502.
