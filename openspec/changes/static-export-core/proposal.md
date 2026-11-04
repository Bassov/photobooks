## Proposal

Roadmap: `docs/roadmap/P3/static-export-core.md` (scope / Done when SoT).

### Scope out

- File writes, derivative requests, progress UI (`static-export`).
- Viewer UI: a minimal injectable default renderer (title + spread images); `site-viewer` replaces it.
- Storage of `published.json` revisions (input is already-parsed revisions).

### Delta / Risk

- New capability `src/site/export/` + spec `site-export`; read-only reuse of `publishBook` revisions, `siteAssetIds`, `DERIVATIVE_PRESETS`.
- Security/privacy: no asset `meta` (GPS, captions) or file names leave the library; HTML via `renderToStaticMarkup` (escaped).
