## Decisions

1. **Opt-in.** `PreflightOptions.cover?: { layout: 'single' | ImpositionLayout; colors?: readonly ColorWarning[]; textAdvanceMm(text, sizeMm): number }`. No option or a booklet layout → no cover issues; the worker passes none yet, so the dialog never sees a cover row, `scope` or the new fix id.
2. **Front ppi.** `coverGeometry(profile, book)` gives the sizes. The editor's `frontPpi` formula is copied into `preflight.ts` (depcruise `core-is-pure` forbids importing `src/render`); a unit test pins it to `coverPanelPpi` numbers. Asset px are EXIF-oriented. Only the worse dpi row.
3. **Front photo.** No `assetId` → `cover-front-empty`. Unknown or `missing` → `cover-asset-missing` (no dpi); `modified` → `cover-asset-modified` plus dpi. `cover-not-srgb` when `colors` holds the front asset; the issue carries `family`.
4. **Spine.** Empty trimmed text → none. size = min(coverW·12/848, spine/2) mm; pt < `minFontPt` → `spine-text-small`; injected `textAdvanceMm(text, size) > trimH − 2·safe` → `spine-text-cut` (core has no font metrics).
5. **Rows.** The rule table gains `scope`; `PreflightRow.scope` copies it (`color-space` = `pages`). Cover issues have no location, so no page list; existing sort puts them after interior rows of their severity. New fix id `edit-cover`.

## Touch-set & Test Plan

| Path                                       | Why                                      |
| ------------------------------------------ | ---------------------------------------- |
| `src/core/print/preflight.ts`              | rules, `cover` option                    |
| `src/core/print/preflightText.ts`          | texts, `scope`                           |
| `src/core/print/pdfFileName.ts`            | `pdfCoverFileName` = stem + `-cover.pdf` |
| `src/core/index.ts`                        | barrel exports                           |
| `src/core/print/preflight.test.ts`         | fire / not-fire per rule                 |
| `src/core/print/preflight.pbt.test.ts`     | ≤1 dpi row, booklets none                |
| `src/core/print/preflightText.test.ts`     | texts, order, scope                      |
| `src/core/print/preflightText.pbt.test.ts` | cover rows: scope cover, no pages        |
| `src/core/print/pdfFileName.test.ts`       | preset and W×H cover names               |

No e2e: no UI change.
