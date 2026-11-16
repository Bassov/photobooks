## Proposal

Roadmap: `docs/roadmap/P4/cover-pdf.md` (scope / Done when SoT). UI ref: `uikit#/full/pdf-export`.

### Scope out

- Core painter, cover rules, file name (done); kit.
- `--thumb-spine`: a page-split hairline, not a cover spine.

### Delta / Risk

- e2e: Cover row both layouts (happy), no cover rows with booklets (empty), two files + Open cover (interact). No page-level scroll.
- A cover failure leaves the pages file; the step fails, Try again re-runs both.
- Security: one more FSA writable per run, aborted on failure; the worker `cover` request uses the existing message path, Open cover the existing blob URL path.
