## Decisions

1. Add `if (e.altKey || e.ctrlKey || e.metaKey) return` at the top of the book-page keydown in `site-viewer.tsx`, before the arrow / Home / End steps, matching the lightbox handler in the same file (already guarded).
2. Other kit keydown handlers: lightbox (`site-viewer.tsx` lightbox `k`) already guarded; `demo-parts/site.tsx` preview shell only handles Escape / Tab and passes Alt+Arrow on purpose; sandbox handlers (`chrome.tsx`, `store.tsx`, `viewport.tsx`, `canvas.tsx`) are editor shortcuts, not site page steps — left out.
3. No new tokens / primitives (no visual change).

## Touch-set & Test Plan

| Path                                 | Reason         |
| ------------------------------------ | -------------- |
| `uikit/src/features/site-viewer.tsx` | modifier guard |
| `e2e/kit-preview-mod-arrows.spec.ts` | new kit e2e    |

- Reuse: `openPreview` / `slide` flow from `e2e/kit-preview-fold-strip.spec.ts` (copied, spec-local).
- Tests: e2e — on Pages 2–3, Alt / Control / Meta × ArrowRight / ArrowLeft / Home / End keep `site-page-indicator`; plain ArrowRight → Pages 4–5. No unit / PBT (kit has none for this handler).
