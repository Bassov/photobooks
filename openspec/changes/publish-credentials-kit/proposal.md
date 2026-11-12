## Proposal

Roadmap: `docs/roadmap/P3/publish-credentials-kit.md` (Spec `publish-credentials` § Kit changes). UI ref: `uikit#/feature/site-settings`.

### Scope out

- Prod (`src/**`): Hosting UI, validation, check, CSP.
- `#/demo` steps, demo baselines, `uikit/scripts/qa.mjs`, `uikit/src/kit/pages.json`.

### Delta / Risk

- e2e on `#/full/site-settings`: empty, happy (Connect → connected), interact (Replace, Forget, Copy). Scroll only inside Settings `main`; no page scroll.
- Security: kit-only, no network; the secret never reaches DOM, URL or logs (e2e asserts).
