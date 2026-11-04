## Proposal

Roadmap: [`docs/roadmap/P3/site-viewer-kit.md`](../../../docs/roadmap/P3/site-viewer-kit.md) (scope / Done when SoT).

### Scope out

- Prod `src/` (site entry, renderer): design items 2–3.
- Kit neighbour pre-mount, hash state, native `navigator.share`.
- `uikit/src/sandbox/*`, `site-photographer.tsx`, site-awards files.

### Delta / Risk

- Kit-only, `skip_specs: true`. Empty state N/A: the demo publishes ≥ 1 book.
- No page-level horizontal or vertical scroll; scrolling only inside `[data-testid=site]`.
