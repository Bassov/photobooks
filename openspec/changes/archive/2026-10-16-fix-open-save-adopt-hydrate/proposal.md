# Proposal

## Problem

After exploratory use of open-save: (1) session work cannot become a library book without «New book», which resets the document; (2) after save + reload, filmstrip thumbs stay gray, placed frames empty, and some photos look stretched.

## Why now

`open-save-project` shipped the storage path, but adopt is unwired, session imports lack durable identity, and DerivedCache hydrate gaps leave previews missing after reload.

## Scope in

- After create/open library, adopt the in-memory book (no wipe); Save/Ctrl+S works with library open even before an explicit «New book»
- On adopt, upgrade session assets that still have live Files so they carry durable identity and hashes needed for reopen hydrate
- After save + reload, hashed thumbs and placed-frame previews reappear; landscape photos keep a correct cover crop (not square-forced)
- Confirm before «New book» when gallery/placements are non-empty
- Spec delta: `editor-shell`; Playwright locks both failure modes
- Roadmap item `fix-open-save-adopt-hydrate` owns this change (already listed before `autosave`)

## Scope out

- Autosave; permission re-grant; missing-assets relink; FSA photo-folder handle persistence
- Schema bump for width/height on asset records
- Changing LibraryStorage / SessionState / AssetSource domain contracts

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `editor-shell`: adopt session book into open library; identity upgrade on adopt; durable hashed preview hydrate after reload (thumbs + placed frames); aspect restored from hydrate

## Success criteria

- Empty: no library — create/open visible; Save disabled; filmstrip + pasteboard remain the only scrollports (no page-level H/V scroll)
- Happy path / Browser check: session import → create/attach library → Save without «New book» → reload — same gallery ids/placements; thumbs and placed frames show images (not all gray/empty placeholders); landscape fixture is not forced to square crop; no page-level H/V scroll (filmstrip + pasteboard only)
- Primary interact: Save still schedules off the gesture path; existing save-during-drag gate remains green
- «New book» with non-empty gallery/placements: confirm appears; cancel leaves the document unchanged; confirm creates an empty book

## Risks

- **Security:** no new FSA surface beyond existing library picker; identity upgrade uses in-session File bytes only; handles stay out of `book.json`
- Size: wiring + cache backfill only — no new subsystem; Save awaits pending hashes before the durable write
