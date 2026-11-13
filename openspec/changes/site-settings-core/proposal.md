## Proposal

Roadmap: `docs/roadmap/P3/site-settings-core.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Settings → Site UI, Preview wiring, dark theme CSS / GL (later items).
- `renderSitePage.tsx`, `src/site/book/**`, `uikit/**` (other lanes).

### Delta / Risk

- `library.json` gets an optional `site` object with no schema bump.
- Without site settings the output is byte-identical (`{ title: 'Photobooks' }`).
