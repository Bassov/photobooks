## Decisions

1. `buildSiteTree({ meta, revisions, derivatives, viewer?, renderer? })` is async (Web Crypto SHA-256), DOM-free and worker-safe; returns `{ files, missing }`, `files` sorted by path in code-unit order (no `localeCompare`, no clock, no random ids).
2. A book is exported iff `bookPublishStatus(meta, id) === 'published'` and a revision exists; its content comes only from `revision.book`. Draft books are not an input. Duplicate revision ids or duplicate `(assetHash, presetId)` derivatives throw (no order-dependent pick).
3. Layout: `index.html`, `books/<sha256(id)[0..16]>/index.html`, `assets/<sha256(bytes)>.<webp|jpg>` (content-addressed, deduped), `viewer/<path>` (bundle copy; relative, no `.`/`..`/empty segments, unique, entry among them, else throw; entry referenced by every page), `site.json` manifest (arrays only, books newest-first then id).
4. Assets per book: `siteAssetIds(revision)` → `contentHash`; unhashed assets are skipped. Every `DERIVATIVE_PRESETS` preset is wanted; absent ones go to `missing` and are never referenced. Only wanted derivatives enter the tree.
5. Pages: `SitePageRenderer { index, book }` returns React elements, rendered with `renderToStaticMarkup` behind `<!doctype html>`; models carry page-relative URLs. Default: title + `site-display` image per resolved spread frame, in reading order.
6. Privacy: no asset `meta`, `relativePath`, `sourceRootId` or `publishedAtMs` in output.

## Touch-set & Test Plan

| Path                                  | Why                        |
| ------------------------------------- | -------------------------- |
| `src/site/export/types.ts`            | input / model / tree types |
| `src/site/export/buildSiteTree.ts`    | builder                    |
| `src/site/export/defaultRenderer.tsx` | minimal default pages      |
| `src/site/export/index.ts`            | public API                 |
| `src/site/export/*.test.ts(x)`        | unit + snapshot + PBT      |
| `openspec/specs/site-export/spec.md`  | new capability spec        |

- Reuse (import only): `bookPublishStatus`, `siteAssetIds`, `displayBookTitle`, `resolveParentFrames`, `resolvePresets` (preset id → mime, unknown id throws), `sha256HexSync` (book ids only).
- Tests: inline snapshot + double export byte-equality; PBT ≥1000 runs (shuffled books/derivatives, unpublished + draft edits absent, every referenced path present); unit for throws, viewer, missing. No e2e.
