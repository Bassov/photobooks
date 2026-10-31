# design-r2-layout-picker

Tag: feature
Milestone: P1
Title: Bug: design-r2-layout-picker - Spread inspector Layout picker = kit (M21)
Status: done

## Scope

- [x] M21 Layout section header = kit `Section` (uppercase "LAYOUT" eyebrow trigger + chevron, summary only when collapsed, "Save as template" `+` on the right).
- [x] M21 tiles = kit `TemplateTile`/`TemplateThumb`: 2:1 paper thumb with hairline, placeholder slots, spine; 11 px two-line caption; hover / selected / focus states; Full bleed preview clipped to the thumb (no edge lines).
- [x] M21 picker set and order = kit builtin list (Full bleed, One per page, Hero + two, Hero + grid, Panorama, Three across, Framed single, Offset pair, Two portraits, Landscape + 2 portraits); `2-up` / `4-grid` stay valid ids for existing books only.
- [x] M21 hovering / focusing a tile previews its slots on the active spread (kit `canvas.tsx` `TemplatePreview`).
- [x] M2 verify: no Spread properties block; inspector header row = icon + "Spread" + meta + "Hide inspector (I)" PanelRightClose.
- [x] M25 Preview mounts no editor overlay (no frame controls, handles, size tag, grid, guides); selection intact after exit.
- **Done when:** e2e `design-r2-layout-picker.spec.ts` (header, kit order, tile sizes, Full bleed clip + edge pixels, section order) and `preview-no-overlays.spec.ts` pass with `--repeat-each=30`.
- **Browser check:** select a spread: Layout section matches `#/demo` step 14 (tiles, captions, Full bleed tile); hover a tile → dashed slot preview on the spread; select a frame, turn on grid, open Preview → clean book; exit → frame still selected.
- **Perf:** hover preview re-renders only the overlay of the active spread; template geometry stays memoized per grid/trim (existing frame-budget gates unchanged).
- **UI kit:** `uikit/src/sandbox/context-inspector.tsx` (`InspectorShell`, `LayoutSection`, `TemplateTile`), `uikit/src/sandbox/chrome.tsx` (`TemplateThumb`), `uikit/src/sandbox/canvas.tsx` (`TemplatePreview`), `uikit/src/data.ts` + `uikit/src/sandbox/templates.ts` (builtin order); UI ref: `uikit#/demo` steps 14 / 23. partial: My templates (custom templates) and the Master & spacing / Background sections are not in this item.
- **Source:** Owner via Designer, 2026-10-31 (M21, M2, M25).
