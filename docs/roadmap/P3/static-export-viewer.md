# static-export-viewer

Tag: feature
Milestone: P3
Title: Export site ships the viewer bundle

## Scope

- [ ] The editor's Export site run passes the built site viewer (`site.html` entry: module script, its preloaded chunks, stylesheets and the files they reference) to the export worker as `SiteViewerBundle`, so exported pages hydrate (lightbox, hash navigation) instead of staying static HTML
- **Done when:** e2e on the preview build: the exported `dist/` has `viewer/` files, `index.html` links the viewer entry, and a served `dist/` book page opens the lightbox; a second export stays byte-identical
- **Hard nos:** no fetch of anything outside the app origin; no new dependency
- **Test:** unit for the bundle collection (pure HTML / CSS reference parsing); e2e on the `?fixture=` editor
- **Depends:** static-export
