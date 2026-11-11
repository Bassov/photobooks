## Proposal

Roadmap: `docs/roadmap/P4/personal-site-kit-port.md`. UI ref: `uikit#/feature/personal-site`.

### Scope out

- Prod `src/**`, `uikit/src/demo-parts/**`, old kit site (`site-viewer`, `site-photographer`).
- Share / Fullscreen, stand demos 1–6.

### Delta / Risk

- e2e: empty `?books=1`, happy `?books=6` home → room, interact Play / pager. No page-level H/V scroll; scrolling only inside `.ss-scroll`.
- Vendored three r170 (stand-reviewed); no new dependency, no blob / worker.
