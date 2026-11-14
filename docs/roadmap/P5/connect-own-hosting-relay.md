# connect-own-hosting-relay

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item connect-own-hosting-relay
Status: done

## Scope

- [ ] Stateless same-origin relay `/api/cf/*` on our Worker (`src/worker/index.ts`, pure `src/worker/cfRelay.ts`) that forwards an exact method + path allowlist to `https://api.cloudflare.com/client/v4` (api.cloudflare.com sends no CORS headers); Spec `connect-own-hosting` § Relay, C2, C3
- [ ] `wrangler.jsonc`: `main`, `assets.binding: "ASSETS"`, `assets.run_worker_first: ["/api/cf/*"]`; everything else stays assets-only; observability never records request headers (else `enabled: false`)
- [ ] Worker tsconfig, `knip.json` entry, lint rule: no `console.*` in `src/worker/**`
- [ ] `docs/future-architecture.md` § Site host: Q-10 exception for `/api/cf/*` with the Owner's Q-16 quote
- **Done when:** R1 Origin = the request's own origin AND `Sec-Fetch-Site: same-origin`, else 403; exact allowlist (`:a` 32 hex, `:b` bucket regex, `/zones` query keys limited), else 404; `DELETE /user/tokens/:id` only for the id the relay's own verify call returns for the same token. R2 JSON bodies ≤16 KB, schema-checked (`POST /user/tokens`: one allow policy, exactly the Bucket Item Write group, exactly one `com.cloudflare.edge.r2.bucket.<a>_default_<b>` resource, no condition, name ≤120; broader → 403; CORS origins = exactly the request origin); forward only `Authorization` + `Content-Type`; strip `set-cookie` / `cf-*`; `Cache-Control: no-store`. R3 nothing stored or logged: tests for every branch + PBT (random paths/methods never forwarded unless allowlisted); a `wrangler dev` log with no Authorization value; PR `## Security Review`
- **Browser check:** n/a (no UI); `wrangler dev` relay call with the redacted log in the PR
- **Musts:** see Done when; the relay stores, logs and echoes nothing (Owner, Q-16)
- **Hard nos:** no `src/publish/**`, `uikit/**`, `src/editor/**`, `public/_headers` changes; no backward compat
- **Test:** unit + PBT on the pure handler; no e2e (no UI)
- **Depends:** publisher-targets
