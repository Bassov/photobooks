## Proposal

Roadmap: `docs/roadmap/P3/in-app-publish-kit.md` (scope / Done when / Browser). UI ref: `uikit#/feature/in-app-publish`.

### Scope out

- Prod UI and the worker (`src/**`).
- Real upload, retries, remote manifest: the kit run is a timed stand-in.

### Delta / Risk

- e2e locks empty (connect), happy (run → Hide → pill → done) and interact (Esc / outside click, P7); no scrollport change.
- Existing walks click Publish → Publish; the pill's 4 s done state must not swallow that click.
