## Proposal

Roadmap: [`docs/roadmap/M2.5/design-tokens.md`](../../docs/roadmap/M2.5/design-tokens.md) (scope SoT). UI ref: `uikit#/feature/design-tokens`. Token names from [`docs/design.md`](../../docs/design.md). `skip_specs: true` (chrome CSS/fonts; no domain contract).

### Scope out

- Button/IconButton primitive adoption (later M2.5 items)
- Product theme-toggle UX / localStorage (tokens + `data-theme` only)
- Full Home restyle beyond token substitution

### Delta / Risk

- E2e lock-ins: empty home, happy editor (`?fixture=painter`), filmstrip/pasteboard scrollports (no page-level H/V scroll). Offline after first load: zero third-party font hosts.
- Security: self-hosted fonts only; drop Google Fonts CDN / preconnect.
