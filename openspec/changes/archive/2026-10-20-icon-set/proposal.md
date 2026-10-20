## Proposal

Roadmap: [`docs/roadmap/M2.5/icon-set.md`](../../docs/roadmap/M2.5/icon-set.md) (scope SoT). UI ref: `uikit#/feature/icon-set`. `skip_specs: true` (chrome Icon primitive; no domain contract).

### Scope out

- IconButton / Toolbar adoption (later M2.5 primitives / editor-chrome)
- Replacing uikit’s `lucide-react` demos (kit stays reference)
- Product theme-toggle UX

### Delta / Risk

- E2e: empty `/`; happy `?fixture=painter`; `?specimen` icon grid (size tokens + ~24 names). No page-level H/V scroll — only specimen page scrollport; on painter, only filmstrip/pasteboard.
- Security: no new npm icon package — in-repo SVG set (decision in `docs/design.md`).
