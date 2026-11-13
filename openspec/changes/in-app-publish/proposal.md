## Proposal

Roadmap: `docs/roadmap/P3/in-app-publish.md` (SoT). UI ref: `uikit#/feature/in-app-publish`; Designer spec `in-app-publish` §1, §2, P7, P10, P11.

### Scope out

- Core upload (`src/publish/*`, #576), Hosting form (publish-credentials).
- PDF checkbox, image size select (D2); kit, `src/site/**`, Preview.

### Delta / Risk

- Observables: roadmap Done when, locked by e2e `in-app-publish` (empty: connect; happy: done + republish; interact: Hide + drag, pill width).
- Security: credentials stay in the worker; the page gets a redacted result only; Open site uses `noopener,noreferrer`; CSP unchanged.
