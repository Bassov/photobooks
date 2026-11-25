# qa-blob-revoked

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item qa-blob-revoked

## Scope

Fix QA-5 from `docs/qa/prod-qa-2026-11-25.md`: intermittent console `net::ERR_FILE_NOT_FOUND` for a revoked `blob:` URL right after a photo swap drag and after reload + reopening a book. An `<img>` (src / srcset) or CSS background still asks for an object URL that a cache already revoked.

- [ ] Reproduce first: a unit test that evicts / replaces a URL while a mounted element still references it (tier LRU eviction, thumb replace) and asserts the URL is not revoked; an e2e that collects `requestfailed` on `blob:` through swap drags and reload + reopen of a book with ≥12 photos.
- [ ] Root cause: never revoke an object URL a document element still references; defer the revoke until it is released, without unbounded growth (LRU caps unchanged, tested).
- [ ] Cover every `revokeObjectURL` site in `src/`; the PR body lists each as fixed or left out with a reason.
- **Browser check:** swap two placed photos by drag, save, reload, reopen the book from the library: DevTools shows no `ERR_FILE_NOT_FOUND` for `blob:` URLs.

## Done when

The new unit test fails on main and passes on the branch; e2e swap drag + reload/reopen of a book with ≥12 photos logs 0 `requestfailed` on `blob:` URLs; existing `objectUrlLru`, `thumbCache`, `tierCache`, `loadPhoto` tests pass; LRU cap unchanged.
