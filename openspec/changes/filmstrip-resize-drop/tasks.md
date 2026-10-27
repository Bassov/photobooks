## Implementation

- [x] 1. `filmstripSize` store + height-parametrised `thumbSlotSize` helpers (unit tests)
- [x] 2. Filmstrip/FilmstripItem consume the height; spacer/window use it
- [x] 3. Dock splitter + slider (CSS var during drag, commit on release)
- [x] 4. Desktop folder drop on the dock via `onDropPhotoFolder`
- [x] 5. Component + e2e tests; spec delta

## Manual test scenarios

1. Resize via splitter and slider while scrolled mid-gallery; no gaps.
2. Drop a folder / loose files from the desktop.
