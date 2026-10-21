## Proposal

Roadmap: `docs/roadmap/M2.5/dark-theme.md`. UI ref: `uikit#/feature/dark-theme`.

### Scope out

- Visual-regression screenshot baselines (deferred backlog)
- Filmstrip thumb geometry / remaining M2.5 chrome adoption
- New theme-domain OpenSpec capability (chrome CSS + toggle only)

### Delta / Risk

- E2e: empty home + happy painter; toggle chrome/paper; axe both themes; mid-pasteboard toggle with `useSyncExternalStore` only on the toggle control. No page-level H/V scroll; scrolling only inside `pasteboard-scroll` and `home`.
