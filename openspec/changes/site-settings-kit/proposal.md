## Proposal

Roadmap: `docs/roadmap/P3/site-settings-kit.md` (scope / Done when / Browser). UI ref: `uikit#/feature/site-settings` + Designer Spec `site-settings` (Theme S5 / S6 cancelled, Owner 2026-11-13).

### Scope out

- Prod (`src/**`): store, library.json, Settings nav, export / publish — later items.
- `#/demo` steps and baselines, `uikit/scripts/demo-capture.mjs`: unchanged.

### Delta / Risk

- Kit-only, no spec delta. e2e: empty (placeholders, `0 / 160`), happy (commit / Esc / paste, Preview lead), the one light look (`#f4f3f0` site + bars). Removing the dark look only deletes branches nothing reached. No new scrollport: Settings `main` already scrolls.
