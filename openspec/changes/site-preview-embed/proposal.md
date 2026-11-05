## Proposal

Roadmap: `docs/roadmap/P3/site-preview-embed.md` (scope / Done when / Browser SoT). Design: Designer `site-preview-mode` spec §3, §5.

### Scope out

- The editor's `SitePreview` shell, keys and slide renderers (item 3, `src/editor/**`).
- Kit (`uikit/`), export (`src/site/export/**`), `src/core/**`.

### Delta / Risk

- New props are off by default: the published site renders byte-identical (`renderSitePage` snapshot, site-viewer / site-lightbox e2e lock it).- CSS split must keep rule order: `site.css` imports `siteViewer.css` where the rules were.
