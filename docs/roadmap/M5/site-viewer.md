# site-viewer

Tag: feature
Milestone: M5
Title: viewer entry

## Scope

- [ ] Separate Vite entry: catalog, book page, spread navigation, `srcset`; captions via the same `SpreadView`
- [ ] Site theme: own palette on the same token scales (`docs/design.md`)
- **Perf:** `content-visibility` for off-screen spreads; Lighthouse budgets for the viewer entry.
- **Browser check:** open the viewer entry on a fixture library; catalog → book → spreads; photos are light on mobile.
- **UI ref:** `uikit#/feature/site-viewer`
- **UI kit:** `uikit/src/features/m5m7.tsx:288-291` (`site-viewer` demo + notes), `UI ref: uikit#/feature/site-viewer` — catalog / book / spread site entry
