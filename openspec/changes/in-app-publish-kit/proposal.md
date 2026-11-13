## Proposal

Roadmap: `docs/roadmap/P3/in-app-publish-kit.md` (scope / Done when / Browser). UI ref: `uikit#/feature/in-app-publish`.

### Scope out

- Prod UI and the worker (`src/**`: items `in-app-publish`, `in-app-publish-core`).
- Real upload, retries and the remote manifest: the kit run is a timed stand-in.

### Delta / Risk

- e2e locks empty (no hosting → connect), happy (opts → run → Hide → pill NN% → done link) and interact (Esc / outside click hide the run; P7; pill width in every state). No scrollport change.
- Existing walks (`demo-capture`, `kit-personal-site-demo`) click Publish → Publish; the pill's 4 s done state must not swallow a later click.
