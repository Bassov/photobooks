# Proposal

## Why

- Library-backed import today awaits every file's `arrayBuffer()` before enqueueing gallery placeholders, so re-importing into an existing project (e.g. to restore an empty thumbnail cache) stalls with no progress until the whole selection is read.
- Fresh session imports already show placeholders and progress immediately; re-import must feel the same (owner priority 2026-10-19, #125).
- Why now: M2.2 after `asset-metadata-extract`; users hit this when DerivedCache is cleared.

## What Changes

- Stream gallery identity from cheap file fields first on the library path (same as session); seed bytes / hash per file with a capped in-flight read window (≤16).
- Apply the same capped read pattern when upgrading session assets into a library.
- Prove re-import of already-imported files does not duplicate gallery entries and restores thumbnails (test first; match/reuse only if the test fails).
- Lock progressive first-card timing, reads-in-flight cap, and scroll-during-import LoAF/INP/handler budgets with unit + library-backed e2e.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `photo-card`: library-backed (and session-upgrade) import MUST enqueue placeholders before whole-set body reads finish; re-import of matching files MUST reuse assets and restore thumbs; bulk re-import MUST meet the same progressive + frame-budget bar as fresh import.

## Impact

- Code: `src/editor/importPhotos.ts`, `src/editor/upgradeSessionAssets.ts`, unit tests, one library-backed e2e scenario (filmstrip / frame-budget).
- Out of scope: moved-folder relink (`missing-assets-relink`, M2.5); no dependency changes; no edits to parallel sessions' files (`scripts-in-scope`, `book-titles`).
- Success: Browser check (placeholders + progress immediate on re-import; thumbs fill; filmstrip scrolls; thumbs survive reload) and Perf (stream identity, capped reads, zero LoAF / handler≤4 ms / INP≤100 ms on 200-file library re-import) from the roadmap item.
- Risks: incorrect identity match could skip a truly new file (mitigate: path+size+mtime then content hash; test both reuse and append-new); delaying hash must not break Save (`awaitPendingHashes` unchanged).
- Security: no widened FSA / worker / blob surface — workers still get transferables only; memory seed stays scoped to registered roots; hash remains best-effort.
