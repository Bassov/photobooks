# asset-metadata-extract

Tag: prep
Milestone: M2.2
Title: fill metadata off the main thread
Status: done

## Scope

- [x] Metadata extraction job on the existing pool fills the `asset-metadata-schema` fields (`exifr`), at background priority
- [x] `AssetSource.scanRoot` walks the folder in the worker (closes the `editor-shell-filmstrip` shipped note)
- [x] `matchAssets` reports `ok | missing | modified` per asset (same root and path, different size/mtime and hash is `modified`)

## Done note

metadata extract @background (exifr); worker scanRoot; matchAssets ok|missing|modified; GPS via caller opt-in (default off), site-export omit per book-core
