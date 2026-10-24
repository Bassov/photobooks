## Implementation

- [x] 1. Spec deltas: asset-source (manifest + hydrate-before-scan) + filmstrip (aspect slots from manifest); trim obsolete entry-index-only wording
- [x] 2. Versioned manifest parse/serialize with optional width/height/orientation; corrupt/version → miss; merge dims on scan persist
- [x] 3. Batched IDB persist with yields; decode/import writes dims back off hot path
- [x] 4. Restore: enqueue from manifest (aspects + identity) before `scanRoot`; then always walk, diff, update gallery/manifest
- [x] 5. Unit: manifest-before-scan; diff add/change/remove; corrupt/version fallback; merge dims
- [x] 6. e2e green: open-save reload hydrate; filmstrip; frame-budget/LoAF unchanged (e2e-changed + stryker:diff green vs origin/main)

## Manual test scenarios

1. Import ~folder, Save, reload: filmstrip slots + thumbs appear before folder walk finishes; walk still runs and reconciles.
2. Add/change/remove files on disk, reload: gallery diffs (new/changed regenerate, removed gone); UI stays responsive during manifest write.
3. Corrupt or version-mismatched IDB row for a root: no crash; rebuild from scan.
4. N/A multi-folder / unsupported browser.
