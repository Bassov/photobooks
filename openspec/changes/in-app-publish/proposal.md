## Proposal

Roadmap: `docs/roadmap/P3/in-app-publish.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/feature/in-app-publish`; Designer spec `in-app-publish` §1 Pill, §2 Dialog, P7, P10, P11.

### Scope out

- Core upload (`src/publish/publishSite.ts`, `publish.worker.ts`, `r2Errors.ts`): used as merged in #576, unchanged.
- PDF download checkbox and web image size select (hidden until `pdf-export`; D2).
- Kit (`uikit/**`), site viewer (`src/site/**`), Preview (`SitePreview.tsx`).

### Delta / Risk

- Observables e2e locks in: empty (no hosting → connect → Settings on Hosting), happy (publish → Published, link + Open site URL; republish PUTs only changed keys), interact (Hide during the run, canvas drag still works; pill width ±0.5 px in every state; 503 ×3 → "x of y" → Try again sends the rest; 403 → key + "Can't connect").
- Security: credentials stay in the worker (P8); the page gets progress and a redacted result only; failure text comes from codes plus the bucket name, never the key; Open site uses `noopener,noreferrer`; CSP unchanged.
