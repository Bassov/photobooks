# derived-cache-opfs

Tag: prep
Milestone: M2
Title: persistent preview cache

## Scope

- [x] `DerivedCache` interface; OPFS adapter keyed by `(assetHash, presetId)`; zoom tiers and thumbnails persist via DerivedCache (OPFS) while keeping a bounded hot object-URL LRU
