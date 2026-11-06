## ADDED Requirements

### Requirement: Viewer bundle in every export

The production build SHALL emit `site-viewer.json` listing the site viewer entry's files (entry chunk, static imports, CSS, assets). Every Export SHALL load those files into the worker request's `viewer`, with root-absolute CSS `url(/…)` rewritten relative to `viewer/` and their files included, so the exported book pages link the viewer CSS and JS; a missing manifest or file SHALL fail the export with `unknown`.

#### Scenario: Served export

- **WHEN** an exported `dist/` is served by a plain static server and a book page is opened
- **THEN** the viewer CSS applies, the next page turns, and no asset request 404s
