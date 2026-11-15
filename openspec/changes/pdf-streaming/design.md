## Decisions

1. **Streaming writer** (`pdfStream.ts`): serializes pdf-lib objects exactly as `PDFWriter` does (header, `n g obj … endobj`), records each object's offset, deletes it from the context once written; `finish` writes the kept objects, a sorted classic xref table, trailer dict and `startxref`. Page leaves, the page tree, catalog and Info stay in the context to the end (`insertLeafNode` looks every earlier leaf up).
2. **Paint**: each photo is read, embedded, colour-tagged and flushed as its own chunk before the next is read; only `{ ref, width, height, orientation }` stays. Each sheet's content stream is flushed after the sheet. `paintBookPdf` takes `onChunk` and returns `{ bytes, sheets, skipped }`.
3. **Impose**: loads the page PDF whole (pdf-lib needs it), embeds each side's pages and flushes after every sheet.
4. **Protocol**: `{ chunk: ArrayBuffer }` messages (transferred) before `done` (`bytes`, no PDF). Impose takes the page PDF as a `Blob` built from the paint chunks (each wrapped in a `Blob` as it arrives, never concatenated).
5. **Write**: `openExport` replaces `writeExport`: opens `<library>/exports/<file>` before painting, writes each chunk in order, `close` on done, `abort` on any failure. Access, full and other codes and the progress, saving and done events are unchanged.
6. **Security**: only transferred buffers cross the worker; writes go only to the user-granted library folder; abort keeps a previous PDF intact.
7. **Status flake**: `SiteJobPill`'s live status was set in an effect, one commit after the pill title; it is now derived during render (state adjusted while rendering), so both commit together.

## Touch-set & Test Plan

| File                                     | Why                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `src/core/pdf/pdfStream.ts`              | streaming writer                                                        |
| `src/core/pdf/pdfStream.test.ts`         | PBT: chunks concatenate to a PDF whose xref offsets point at each `obj` |
| `src/core/pdf/paintPdf.ts`               | photos and sheets flushed                                               |
| `src/core/pdf/imposePdf.ts`              | sheets flushed                                                          |
| `src/core/pdf/pdf.worker.ts`             | chunk protocol                                                          |
| `src/core/pdf/pdfChunks.test-helpers.ts` | collect chunks in tests                                                 |
| `src/core/pdf/paintPdf.test.ts`          | photo chunk before the next read                                        |
| `src/core/pdf/paintPdf.color.test.ts`    | collect helper                                                          |
| `src/core/pdf/paintPdf.look.test.ts`     | collect helper                                                          |
| `src/core/pdf/imposePdf.test.ts`         | collect helper                                                          |
| `src/core/pdf/pdf.worker.test.ts`        | chunk messages                                                          |
| `src/project/fsa/writeExport.ts`         | `openExport`                                                            |
| `src/project/fsa/writeExport.test.ts`    | write / close / abort                                                   |
| `src/project/index.ts`                   | export                                                                  |
| `src/editor/print/startPrint.ts`         | stream to the writable, Blob for impose                                 |
| `src/editor/print/startPrint.test.ts`    | chunks written in order, abort on failure                               |
| `src/editor/export/SiteJobPill.tsx`      | status in the same commit                                               |
| `src/editor/print/PrintButton.test.tsx`  | 20/20 loop                                                              |
| `e2e/print-perf.spec.ts`                 | unchanged gates, run green                                              |
