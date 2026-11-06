# static-export-viewer

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item static-export-viewer
Status: done

## Scope

Bug: exported site ships without the viewer CSS / JS. Found by #528 (audit of `static-export`, GAP 1): `buildSiteTree` accepts `input.viewer`, but no production caller sets it.

- [x] The production build lists the site viewer entry's files (`site.html` → `src/site/main.tsx`) in a manifest, so their hashed names are known at export time (`vite.config.ts`).
- [x] Export site loads those files into a `SiteViewerBundle` (`src/editor/export/`) and passes it through the worker request into `buildSiteTree`; every caller of the export path gets the bundle.
- [x] Determinism stays: a second export of the same book is still byte-identical.
- **Done when:** a new e2e exports a published book, serves `dist/` with a plain static server and opens a book page at 390×844 and 1440×900: viewer CSS painted, next page turns, 0 console errors, 0 asset 404s; `e2e/static-export.spec.ts` byte-identical test and the export drag perf test stay green; unit tests show the worker request carries the bundle and `buildSiteTree` output holds the viewer files.
- **Browser check:** Export site into a folder, serve its `dist/` statically, open a book page: styled viewer, pages turn with the arrows.
- **Perf:** viewer files are fetched with async `fetch` and transferred to the export worker; no new long tasks during export.
- **UI kit:** none (no matching component)
