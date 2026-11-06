## Decisions

1. **Reuse the `site` build entry** (`site.html` → `src/site/main.tsx`). A build plugin emits `site-viewer.json` `{entry, css, files}`: entry chunk, transitive static imports, CSS, assets (what `site.html` links), sorted. Dynamic imports stay out: exported pages carry `#site-data`.
2. **`loadSiteViewerBundle`** fetches manifest + files (same origin, async) into a `SiteViewerBundle`. CSS `url(/x)` (CoverView.css Lora @font-face) is rewritten relative to the CSS file and `x` is copied too.
3. **`runExportSite` gets a `loadViewer` dep** (wired in `startExportSite`); the request carries `input.viewer`, bytes transferred; the worker hands `input` to `buildSiteTree` unchanged. Load failure → `failed: unknown`.
4. **Security:** same-origin read-only fetch; `buildSiteTree` validates paths; non-ok fails. UI: N/A, no new tokens, viewer CSS unchanged.

## Touch-set & Test Plan

| Path                                         | Why                          |
| -------------------------------------------- | ---------------------------- |
| `scripts/vite-site-viewer-manifest.mjs`      | plugin + pure manifest       |
| `scripts/vite-site-viewer-manifest.d.mts`    | types                        |
| `scripts/vite-site-viewer-manifest.test.mjs` | unit                         |
| `vite.config.ts`                             | register plugin              |
| `src/editor/export/siteViewerBundle.ts`      | loader + CSS url rewrite     |
| `src/editor/export/siteViewerBundle.test.ts` | unit                         |
| `src/editor/export/exportSiteRun.ts`         | `loadViewer` → request       |
| `src/editor/export/exportSiteRun.test.ts`    | unit: request carries bundle |
| `src/editor/export/startExportSite.ts`       | wire loader                  |
| `src/editor/export/startExportSite.test.ts`  | unit                         |
| `src/site/export/buildSiteTree.test.ts`      | output holds viewer files    |
| `e2e/static-export-viewer.spec.ts`           | served dist, both sizes      |
