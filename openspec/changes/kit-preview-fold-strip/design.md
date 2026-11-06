## Decisions

1. Cause: `MiniSpread` always draws the fold hairline (`left-1/2 w-px bg-black/10`); its `si === 0` right-page clip leaves it as the page's first column. The last slide's wrapper clip is changed too (defensive, same path).
2. `MiniSpread` gets `page?: "l" | "r"`: clip to that page, no fold. `SiteViewer.page()` (stage + lightbox) passes `"r"` for slide 1 and `"l"` for the last slide (`n > 1`) and drops the wrapper clip. No `page` = unchanged (spread-list thumbnail keeps its look). No token change.

## Touch-set & Test Plan

| Path                                        | Why                            |
| ------------------------------------------- | ------------------------------ |
| `uikit/src/sandbox/chrome.tsx`              | `MiniSpread` `page` prop       |
| `uikit/src/features/site-viewer.tsx`        | first / last slide pass `page` |
| `e2e/kit-preview-fold-strip.spec.ts`        | paint probe (new)              |
| `docs/roadmap/P4/kit-preview-fold-strip.md` | item filled from the brief     |

- Reuse: `paintProbe.ts` `pixelsAt`; demo setup as `e2e/kit-undo-fixes.spec.ts`.
- e2e (`#/demo` → Preview): slide 1 left edge columns 0–4 px are paper (stage + lightbox); the last slide's right edge columns too, and nothing paints past it; a two-page slide's centre column is darker than paper.
