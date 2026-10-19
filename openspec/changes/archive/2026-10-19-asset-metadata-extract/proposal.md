# Proposal

## Problem

Asset records can hold metadata fields (schema v3), but nothing fills them from EXIF off the main thread. Folder scan still walks on the main thread (editor-shell-filmstrip shipped note). `matchAssets` only returns matched/unmatched — not per-asset `ok | missing | modified` for later missing-assets UX.

## Why now

Next M2.2 prep after `asset-metadata-schema`. Review cut needs capture time, orientation, and color space in the document, read off the main thread. GPS remains opt-in per `book-core` (#118).

## Scope in

- Background-priority metadata job on the existing asset worker pool (`exifr`) filling schema metadata fields; GPS only when the caller passes opt-in (default off)
- `AssetSource.scanRoot` walks the folder in a worker (closes the filmstrip shipped note)
- `matchAssets` reports `ok | missing | modified` per asset (same root+path, different size/mtime and hash → `modified`)
- Tests proving Scope boxes; no new dependencies

## Scope out

- Missing-assets / assets-panel UI, import UX polish, title rename UI
- Changing `book-core` GPS storage / site-export policy (unchanged from #118)
- New package.json deps; GATE/CI/stryker config edits

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `asset-source`: worker `scanRoot`; metadata extract job at background priority with GPS opt-in flag; `matchAssets` per-asset status

## Success criteria

- Metadata job fills schema fields via `exifr` on the pool at background priority; GPS only when caller opts in
- `scanRoot` walk runs in a worker, not on the main thread
- `matchAssets` status is `ok | missing | modified` as specified
- Scope boxes proven by tests on production paths; `pnpm check` green
- No UI

## Risks

- **Security:** GPS is PII — extract keeps it only on caller opt-in; site export omit stays as in `book-core`. Workers receive bytes/handles only as needed for scan/extract — no directory handles on the domain API
- FSA directory-handle transfer into workers must fail typed if unsupported — no silent main-thread fallback that reopens the shipped note
- Size: one subsystem (extract + worker scan + match status); reuse pool/`exifr`
