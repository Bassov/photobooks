# asset-metadata-extract

Tag: prep
Milestone: M2.2
Title: fill metadata off the main thread

## Scope

- [ ] Metadata extraction job on the existing pool fills the `asset-metadata-schema` fields (`exifr`), at background priority
- [ ] `AssetSource.scanRoot` walks the folder in the worker (closes the `editor-shell-filmstrip` shipped note)
- [ ] `matchAssets` reports `ok | missing | modified` per asset (same root and path, different size/mtime and hash is `modified`)
