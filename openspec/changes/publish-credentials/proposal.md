## Proposal

Roadmap: [`docs/roadmap/P3/publish-credentials.md`](../../../docs/roadmap/P3/publish-credentials.md). UI ref: `uikit#/feature/site-settings` scenario `hosting`; Designer Spec `publish-credentials`.

### Scope out

- Core and kit are merged (#571, #572); no `uikit/**`, `src/site/**` or `public/_headers` edits; no Publish button or upload loop.

### Delta / Risk

- UI: empty (Connect disabled), happy (connected card survives reload), failure, Forget → empty; scrolling only in `settings-scroll`, no page-level H/V scroll.
- Security: secret input uncontrolled, never read back; UI reads `loadHostingSummary` only.
