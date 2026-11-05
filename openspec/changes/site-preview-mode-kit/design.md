## Decisions

1. `DemoSitePreview({ onExit, initial })` styled per spec §6 with kit-local tokens `BAR` / `SUB` (`sandbox/v7.tsx`), `--border`, kit `Button`; holds `SiteViewer single share={false}` in a `StudioProvider` of the open book. The editor stays mounted under it.
2. Key guard: one `document` capture listener; Esc closes (the lightbox's window-capture Esc stops it first: one layer per press); Tab → `trapTab` unless already `defaultPrevented` (lightbox); every key `stopPropagation()` except Alt+←/→ (kit page nav), so editor `window` handlers never run.
3. `SiteViewer`: book-page keys on `document` capture (run beside the guard); `share = true` prop; `siteLayout` subtracts the 36 px All books row when `single` (1280 × 720 → 676).
4. `RootInit.editor.preview: boolean | Partial<SiteState>` feeds the page states; `trapTab` moves into `site.tsx`.

## Touch-set & Test Plan

| File                                    | Why                        |
| --------------------------------------- | -------------------------- |
| `uikit/src/features/site-viewer.tsx`    | share, layout, keys        |
| `uikit/src/demo-parts/site.tsx`         | `DemoSitePreview`          |
| `uikit/src/demo-parts/editor.tsx`       | Preview target             |
| `uikit/src/demo-parts/root.tsx`         | preview initial state      |
| `uikit/src/demo-parts/presentation.tsx` | deleted                    |
| `uikit/src/features/pages.tsx`          | three states + notes       |
| `uikit/scripts/qa.mjs`                  | KS14 → site-preview checks |
| `uikit/scripts/demo-capture.mjs`        | step comment               |

- Reuse: `SiteViewer`, `SiteCover`, lightbox, kit `Button`.
- Tests: kit qa (values ±0.5 at both sizes, Esc order, Delete no-op, Tab trap, focus return); `uikit:typecheck`. No prod tests (kit only).
