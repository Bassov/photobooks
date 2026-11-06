## Proposal

Roadmap: `docs/roadmap/P4/static-export-viewer.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Linking `/fonts/fonts.css` (Inter UI face) from exported pages.
- Off-limits files of open PRs (`siteViewer.css`, `CoverView.css`, #527 editor files).

### Delta / Risk

- e2e observables: served book page styled at 390×844 and 1440×900, first page shown, next page turns; 0 console errors, 0 404s.
- Export fails with `unknown` when the build has no viewer manifest (dev server).
- Security: same-origin read-only fetch; paths validated by `buildSiteTree`; non-ok response fails export.
