# Proposal

## Why

- **Problem:** The app is a branded empty shell. Tooling (verify, Playwright, Stryker, LoAF, LHCI) exists but has never been exercised by a real photo feature.
- **Why now:** Stage 1–2 toolchain is done. A minimal “open one photo → show a card” slice proves the full pipeline before `book.json` and multi-page editing.

## What Changes

### Scope in

- Choose a local image via File System Access API when available, with a hidden `<input type="file">` fallback for tests.
- Show one photo card: orientation-corrected preview, pixel size, reduced aspect ratio, file size.
- Accept JPEG, PNG, and WebP; reject other types (including TIFF) with a visible error.
- Load path keeps the main thread within the LoAF budget; metadata helpers stay testable without DOM.
- Unit, PBT, Stryker, Playwright (input fallback), LoAF budget on a large JPEG import, and LHCI as affected.

### Scope out

- `book.json`, spreads/slots, multi-photo library, persistence, AVIF encode, MCP, Cursor post-edit hooks.

## Capabilities

### New Capabilities

- `photo-card`: pick a local image, load metadata and preview, render a single card or an unsupported-format error.

### Modified Capabilities

- (none)

## Success criteria

- User (or e2e via input fallback) can open JPEG/PNG/WebP and see correct card fields; other types (e.g. TIFF) fail visibly.
- `pnpm verify`, `stryker:diff`, and LHCI pass locally; PR checks (`checks`, `integration`, `lighthouse`, `stryker-diff`) are green.
- Importing a 24MP JPEG keeps LoAF `blockingDuration` ≤ 200 ms in the scenario test.

## Risks

- File System Access API is Chromium-centric; fallback must remain the reliable test path.
- Large JPEG decode can still block if work leaks onto the main thread.
- Orientation edge cases (EXIF 1–8) are mutation-sensitive; weak tests will leave survivors.

## Impact

- Shell UI gains open-photo flow and card/error UI; e2e fixtures and CI jobs exercise the new behavior; small runtime deps for EXIF parsing and boundary validation.
