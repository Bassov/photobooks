## Decisions

1. **Identity = path + size + mtime:** Match/reuse/change detection use `sourceRootId` + `relativePath` + `byteSize` + `mtimeMs` only. No content-hash on import/rescan/match hot paths. Optional schema `contentHash` unused here.
2. **Always cheap full walk + entry index:** Every visit runs worker `scanRoot` (name/size/mtime; no body in walk). Never skip via count/max-mtime. Persist path→size/mtime index for diff/match only — not a walk substitute.
3. **List-first then priority 320:** After scan, enqueue gallery placeholders before `getFile`/body. thumb320 for mounted filmstrip ∪ book-used first; rest idle placeholders. Keep body-read cap 16 when decode runs.
4. **Security:** Reuse photo-root IDB + FSA `read` restore; entry index metadata-only (no bodies); no new trust boundary or picker.
5. **UI:** Theme B; reuse `--thumb`, filmstrip `Status`+`ProgressBar`, `EmptyState`, PhotoThumb/ThumbGrid geometry; simple placeholders; no new tokens; `ui-review` before push.

## Touch-set & Test Plan

- Files: `match.ts`, import/seed/hash-reuse, `photoRootSession.ts`, `useChromeImport.tsx`, entry-index IDB, Filmstrip as needed; specs asset-source/filmstrip/image-tiers (+ photo-card/editor-shell); unit + e2e.
- Reuse: existing scan/import/rescan helpers and visibility→pool boost.
- Tests: unit — metadata-only match; always-walk; list-before-body; decode priority. e2e — placeholders before body; reload walks+reuse; scroll promotes 320. No gate relaxations.
