# recents-home

Tag: feature
Milestone: M2
Title: returning user (hardening on PR #71: Home control, re-grant correctness, dedup, IDB/error/loading/busy, New library clean start)

## Scope

- [x] Home screen with books in the library and recent libraries (handles in IndexedDB)
- **Perf:** home is static list chrome; existing save/gesture gates stay green.
- **Browser check:** reopen the app; the home screen lists recent libraries and their books; one click opens a book; Home returns to home; same folder does not duplicate.
- **UI ref:** `uikit#/feature/recents-home`
