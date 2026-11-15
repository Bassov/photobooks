## Decisions

1. `imposition(pages, layout)` is pure: pad to `P` = smallest multiple of 4 (2-up) / 8 (4-up) ≥ `pages`; with ≥ 2 pages the last page stays last and blanks sit just before it. Slots: 1-based page or `null`, left to right, top to bottom as seen.
2. Saddle sheet `s`: front `[P−2s, 1+2s]`, back `[2+2s, P−1−2s]` (duplex flipped left-right). 2-up sheet = saddle sheet `s`; 4-up sheet `k` = saddle sheets `2k` (top) and `2k+1` (bottom), cut across, stacked top then bottom. A sheet = one paper = two PDF pages.
3. `imposePdf` loads the page PDF with `@cantoo/pdf-lib` (dynamic import), embeds each sheet's pages (`embedPages`), cell = largest page, sheet = 2×1 / 2×2 cells; `onSheet` per sheet.
4. Worker `{ impose: { pdf, layout } }` → `progress { imposed, sheets }` per sheet, then `done { pdf, sheets }` (transferred) or `failed`. It reads only the transferred page PDF; no new I/O.

## Touch-set & Test Plan

| Path                                         | Why                         |
| -------------------------------------------- | --------------------------- |
| `src/core/print/imposition.ts`               | pure sheet order            |
| `src/core/print/imposition.test.ts`          | unit: 8 / 13 / 1 pages      |
| `src/core/print/imposition.pbt.test.ts`      | PBT N 1..200 both layouts   |
| `src/core/pdf/imposePdf.ts`                  | imposed PDF                 |
| `src/core/pdf/imposePdf.test.ts`             | sheets, placement read-back |
| `src/core/pdf/pdf.worker.ts`                 | `impose` request            |
| `src/core/pdf/pdf.worker.test.ts`            | impose messages             |
| `docs/roadmap/P4/booklet-imposition-core.md` | fill stub item              |

Reuse: gates PBT seed; `decodePDFRawStream` read-back. `createPdfWorker.ts` unchanged. No e2e.
