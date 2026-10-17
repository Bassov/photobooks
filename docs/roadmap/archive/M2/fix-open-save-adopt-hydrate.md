# fix-open-save-adopt-hydrate

Tag: feature
Milestone: M2
Title: adopt session work; durable preview hydrate

## Scope

- [x] After create/open library, Save adopts the in-memory book (no «New book» wipe); session assets get identity + hash; DerivedCache put-after-hash; tier falls back to thumb; aspect restored from hydrate
- **Perf:** Save stays off the gesture path; existing save-during-drag gate remains green.
- **Browser check:** import without library → New library → Save → reload — thumbs and placed frames visible, landscape crop not square-forced; document stays viewport-contained.
- **UI ref:** `uikit#/feature/fix-open-save-adopt-hydrate`
