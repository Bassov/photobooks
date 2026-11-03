## Decisions

1. One self-contained `PhotographerSite` in `uikit/src/features/site-photographer.tsx`: fixture (6 books, Spec table),
   layout from the root's own width via `ResizeObserver`, local state (page, fullscreen index, shared). No
   `StudioProvider` / `MiniSpread` (editor geometry).
2. `SiteSpread` draws `T(template).frames` over white paper; `last` = left page only, mirrored t-margin
   `{4, 14, 42, 72}`, one page number, no fold.
3. Tokens: surface `bg-neutral-100`, text `text-foreground` / `text-muted-foreground`, `--page-shadow`,
   `--font-heading` (Lora); the Spec's hex values for ink / rule. No new tokens. One `<style>` scoped under `.ps-site`
   adds only state rules (hover, focus-visible, reduced motion), never overriding utilities.
4. `Fullscreen` exported from `site-viewer.tsx` with `ratio?: number` (default `SW / SH`); opener focus restored on close.
5. Reuse: `BookObject`, `LibStyle`, `hiPhoto`, `pagesOf`, `T`, `P`; `quietBtn` classes copied from site-viewer.

## Touch-set & Test Plan

| Path                                       | Why                           |
| ------------------------------------------ | ----------------------------- |
| `uikit/src/features/site-photographer.tsx` | new page                      |
| `uikit/src/features/site-viewer.tsx`       | export `Fullscreen`, `ratio?` |
| `uikit/src/features/pages.tsx`             | `site-photographer` entry     |
| `uikit/src/kit/pages.json`                 | manifest row                  |
| `uikit/scripts/qa.mjs`                     | smoke `site-photographer`     |

- Tests: kit qa smoke (happy + interact; empty N/A) and the global "renders cleanly" pass; no `src/` change → no
  unit/e2e/PBT. Skill `ui-review` on `uikit#/feature/site-photographer`.
