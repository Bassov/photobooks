## Proposal

Roadmap: `docs/roadmap/P3/static-export.md`. UI SoT: Designer spec `static-export` (2026-11-04) and kit `ExportSiteDialog` / `#/demo` `export-site-*`; they supersede the item's older `PublishDialog` / `publish-*` kit lines.

### Scope out

- Viewer bundle in `dist/`: `static-export-viewer`.
- Cancel, unpublish, image size / PDF options (not in kit, D2).

### Delta / Risk

- e2e: empty (no folder → Export disabled); happy (`dist/index.html`, no drafts, stable pill rect, byte-identical rerun); Hide + drag (zero LoAF); foreign `dist/` refused. No page-level H/V scroll.
- Security: folder handle via picker, writes only under `<folder>/dist/`, no network.
