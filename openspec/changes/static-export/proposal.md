## Proposal

Roadmap: `docs/roadmap/P3/static-export.md`; UI SoT: Designer spec `static-export` (2026-11-04) and kit `#/demo` steps `export-site-*` (`ExportSiteDialog`, `uikit/src/demo-parts/dialogs.tsx`).

### Scope out

- Viewer bundle in `dist/` (pages stay prerendered HTML): `static-export-viewer`.
- Cancel, unpublish UI, web image size / PDF options (not in kit, D2).

### Delta / Risk

- `LibraryStorage` gains `loadPublished` / `savePublished` (`books/<id>/published.json`); Export calls `publishBook` and saves library + revision.
- e2e locks: empty (no folder → Export disabled), happy (options → Export → Hide → drag → `dist/index.html`, no drafts, pill rect stable, byte-identical rerun), foreign `dist/` failed text. No page-level H/V scroll.
- Security: folder handle via `showDirectoryPicker` (readwrite, re-requested on Export), stored in session IDB; writes only under `<folder>/dist/`; no network.
