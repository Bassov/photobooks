## Implementation

- [ ] 1. `library.json` v2 in `src/project/libraryDocument.ts`: v1 → v2 upgrade (`books: {}`), Zod-validated `books` status map, `corrupted` on invalid v2; `LibraryMeta` carries `books`
- [ ] 2. Pure `src/project/publish.ts`: `bookPublishStatus` / `publishBook` / `unpublishBook`, frozen `PublishedRevision` with `serializePublished` / `parsePublished`
- [ ] 3. Pure `siteAssetIds(revision)`: deduped ids of assets the published revision shows (cover, enabled endpapers, resolved spread frames incl. parents)
- [ ] 4. Create-library keeps an existing `library.json` status map
- [ ] 5. PBT (≥1000 runs) on library upgrade + draft / published transitions; unit tests for `siteAssetIds`; FSA / contract tests on v2

## Manual test scenarios

N/A — no UI (prep); behavior is locked by unit + PBT.
