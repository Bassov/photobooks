# thumb-pack-storage

Tag: contingency
Milestone: P1
Title: Store a folder's thumbs in one IndexedDB store (only if hydrate is slow)

## Scope

- [ ] Gate: `thumb-bulk-hydrate` measured more than 3 s to hydrate 1000 cached thumbs. If not, this item is closed as not needed in that PR.
- [ ] Thumb-preset entries keyed by identity digest live in IndexedDB as Blob values in one object store with an index on `sourceRootId`, so hydrate is a few `getAll()` calls. Existing OPFS thumb rows stay readable as a fallback; the 1280 working preset stays in OPFS.
- [ ] Spec delta `derived-cache` for where the thumb preset is stored.
- **Done when:** hydrate of 1000 cached thumbs ≤ 1 s on the same fixture; identity semantics unchanged (size or mtime change ⇒ miss); existing derived-cache contract tests green for both backends.
- **Test:** derived-cache contract tests on the new backend + unit
- **Depends:** thumb-bulk-hydrate
