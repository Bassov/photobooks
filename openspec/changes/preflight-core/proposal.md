## Proposal

Roadmap: `docs/roadmap/P4/preflight-core.md` (scope / Done when / tests).

### Scope out

- Any UI, badge or editor wiring (`src/editor/lowDpiBadge*` unchanged); trim / bleed range checks stay in `validatePrintSettings`.
- Folios, captions and cover / endpaper canvases (spreads only).
- File IO: missing / modified come from a caller-supplied relink status map.

### Delta / Risk

- New `src/core/print/preflight.ts`: `preflight(book, profile, { assetStatus })` → issues `{ rule, severity, fix, location, measured?, threshold? }`; DPI reuses `sourceCropRect` / `frameDpi` / `lowDpi` with the passed profile's gates, items come from `resolveSpread`.
- Page count reads `pagesOf` (same number as the editor and spine), checked against `profile.pageCount`.
