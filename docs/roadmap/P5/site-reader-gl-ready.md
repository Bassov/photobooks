# site-reader-gl-ready

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item site-reader-gl-ready

## Scope

- [x] The site reader's GL book marks `data-gl="ready"` when any of its draws lands, not only the latest one: a texture landing during every fenced draw (software GL under load) no longer holds `ready` back until the last face lands (`src/site/book/reader.tsx`; the kit reader `uikit/src/features/site-book/reader.tsx` has the same guard). `data-faces` and the crossfade still follow the latest draw only.
- [x] Unit test: the boot draw landing after a texture asked for a newer one marks `ready`, with `data-faces` still unset.
- **Browser check:** `e2e/site-final.spec.ts:266` and every `ps-reader-gl` ready wait pass `--repeat-each=20` with Chromium pinned to one or two cores (`taskset`); no timeout, retry or assertion loosened.

## Done when

- The cause is named in the PR body with trace timings; the ready waits above pass under load.
