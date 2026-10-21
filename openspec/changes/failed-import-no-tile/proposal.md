## Proposal

Roadmap: `docs/roadmap/M2.2/failed-import-no-tile.md` (scope / Done when / Browser / Perf SoT).
UI ref: `uikit#/feature/editor-chrome-states`, `uikit#/feature/editor-shell-filmstrip`.

### Scope out

- Early type rejects; picker / processPhoto / EditorShell chrome
- HomeScreen, session restore, derived-cache tiers
- UI-kit blank-tile-removal scenario (roadmap: partial)

### Delta / Risk

- Early enqueue stays; decode failure removes tile + `releaseAssetSource` (no dangling blob/object URLs).
- Late `patchAssetRecord` must not resurrect a removed id.
- e2e: corrupt alone → count 0 / no tile / error; valid+corrupt → count 1 / one tile; no page-level H/V scroll — only filmstrip scrollport.
