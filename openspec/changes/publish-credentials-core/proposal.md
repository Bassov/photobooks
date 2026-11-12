## Proposal

Roadmap SoT: `docs/roadmap/P3/publish-credentials-core.md`.

### Scope out

- Hosting section UI and Settings nav (`publish-credentials`); `uikit/**`.
- Publish upload flow (`in-app-publish`).

### Delta / Risk

- Security: CSP limits `connect-src` to self + R2; the token is saved only after a passing check and never leaves `src/publish/`.
