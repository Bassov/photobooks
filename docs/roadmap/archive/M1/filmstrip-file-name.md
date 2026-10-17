# filmstrip-file-name

Tag: feature
Milestone: M1
Title: filmstrip label uses `sessionMeta.name` (File.name), not the sanitized asset id

## Scope

- **Perf:** label reads session metadata only; no gallery id-list rebuild on name refresh.
- **Browser check:** import a non-ASCII file name; the filmstrip thumbnail accessible name matches the file name; selecting it stays smooth; filmstrip remains the horizontal scrollport.
- **UI ref:** `uikit#/feature/filmstrip-file-name`
