## Decisions

1. **Pure planner.** `planSiteWrite(listing, tree)` → `{ ok, delete, write }` or `not-our-export`. Ours = a root `site.json` that parses as our manifest, or an empty `dist/`; `dist` as a file is refused. `delete` = top-most stale entries (removed recursively, before writes); `write` = every tree file, `site.json` first so a half-written `dist/` stays ours.
2. **Path containment.** The planner throws on a tree path with an empty, `.` or `..` segment; the writer walks segment by segment (`getDirectoryHandle`), never joining strings, so writes stay in `dist/`.
3. **Thin writer.** Structural `SiteDirectoryHandle` (FSA subset); a Chromium `FileSystemDirectoryHandle` fits it, the caller casts once (lib `DOM.AsyncIterable` is not loaded).
4. **Errors.** `siteExportErrorCode`: `NotAllowedError` / `SecurityError` → `permission`, `QuotaExceededError` → `quota`, else `unknown`.
5. **Worker.** `runSiteExport(request, post, now)` plus an `onmessage` shell. Request `{ folder, input }`: the handle and `SiteExportInput` minus `renderer` (meta, frozen revisions, derivative bytes, viewer), all plain data that structured clone carries; functions are not cloneable, so the default renderer is used. Progress closer than 250 ms to the last post is dropped; the final message always posts.

## Touch-set & Test Plan

| Path                                                              | Why                                               |
| ----------------------------------------------------------------- | ------------------------------------------------- |
| `src/site/export/writeSiteTree.ts`                                | planner, writer, error code                       |
| `src/site/export/site-export.worker.ts`                           | module worker                                     |
| `src/site/export/buildSiteTree.ts`                                | add-only `publishedRevisions` export (book count) |
| `src/site/export/memorySiteDirectory.test-helpers.ts`             | in-memory handle, op log                          |
| `src/site/export/writeSiteTree.test.ts`                           | planner + writer units                            |
| `src/site/export/writeSiteTree.pbt.test.ts`                       | PBT ×1000                                         |
| `src/site/export/site-export.worker.test.ts`                      | throttle, codes, shell                            |
| `openspec/changes/static-export-writer/specs/site-export/spec.md` | delta                                             |

- Reuse: `buildSiteTree`, `SITE_MANIFEST_PATH`, `siteExport.test-helpers`.
- Worker test feeds a `structuredClone`d input. No e2e (comes with `static-export`).
