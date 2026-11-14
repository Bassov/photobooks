## Proposal

Roadmap: `docs/roadmap/P5/connect-own-hosting-relay.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- The page client `src/publish/cfApi.ts`, provisioning steps and setup UI (core / UI items).
- `public/_headers` (the relay is `'self'` for `connect-src`).

### Delta / Risk

- Security: the Worker's first script sees setup tokens. It stores, logs and echoes none, accepts same-origin calls only, forwards only an allowlist. Observability is off.
