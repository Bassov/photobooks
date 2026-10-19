# Proposal

## Problem

Asset records can hold metadata fields (schema v3), but nothing fills them from EXIF off the main thread. Folder scan still walks on the main thread (editor-shell-filmstrip shipped note). `matchAssets` only returns matched/unmatched — not per-asset `ok | missing | modified` for later missing-assets UX. GPS still has an opt-in gate in the spec even though storage is local-only.

## Why now

Next M2.2 prep after `asset-metadata-schema`. Review cut needs capture time, orientation, and color space in the document, read off the main thread. Owner decision 2026-10-19: drop GPS consent; always store GPS locally; export/publish must strip it by default.

## Scope in

- Background-priority metadata job on the existing asset worker pool (`exifr`) filling schema metadata fields, including GPS when present
- `AssetSource.scanRoot` walks the folder in a worker (closes the filmstrip shipped note)
- `matchAssets` reports `ok | missing | modified` per asset (same root+path, different size/mtime and hash → `modified`)
- Update `book-core` GPS policy: no opt-in; SHALL strip GPS from static export/publish by default
- Tests proving Scope boxes; no new dependencies

## Scope out

- Missing-assets / assets-panel UI, import UX polish, title rename UI
- Actual M5/M7 export/publish implementation (policy SHALL only)
- New package.json deps; GATE/CI/stryker config edits

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `asset-source`: worker `scanRoot`; metadata extract job at background priority; `matchAssets` per-asset status
- `book-core`: GPS always allowed in library document; export/publish strips GPS by default (no opt-in)

## Success criteria

- Metadata job fills schema fields via `exifr` on the pool at background priority (GPS included when EXIF has it)
- `scanRoot` walk runs in a worker, not on the main thread
- `matchAssets` status is `ok | missing | modified` as specified
- Spec/schema/docs remove GPS opt-in; add export/publish strip SHALL
- Scope boxes proven by tests on production paths; `pnpm check` green
- No UI

## Risks

- **Security:** GPS is PII — always local in the book document; export/publish MUST strip by default (policy now; enforcement when export lands). Workers receive bytes/handles only as needed for scan/extract — no directory handles on the domain API
- FSA directory-handle transfer into workers must fail typed if unsupported — no silent main-thread fallback that reopens the shipped note
- Size: one subsystem (extract + worker scan + match status); reuse pool/`exifr`
