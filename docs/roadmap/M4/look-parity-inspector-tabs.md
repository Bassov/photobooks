# look-parity-inspector-tabs

Tag: feature
Milestone: M4
Title: look parity: inspector Frame / Spread / Book tabs
Status: done

## Scope

Look parity, Phase B #1 (Owner 2026-10-29: the editor must look exactly like the UI kit; features may be stubbed): the inspector header is the kit `InspectorPanel` Frame / Spread / Book tabs.

- [x] Header = kit: segmented Frame / Spread / Book tabs (`TabList` size sm: h-7, 2px inset, equal grid columns) + collapse `IconButton` sm in the same `h-12` row; tooltip "Hide inspector (I)"; `]` and `I` toggle (same guards, no modifiers)
- [x] Frame tab: photo rows + Fit & crop unchanged; nothing selected → spread properties + "Select a frame to edit it." (kit `EmptyInspector`); the tab is never removed or disabled
- [x] Spread tab: spread rows + `GridSection scope="spread"`; Book tab: `GridSection scope="book"`; tab panels scroll on their own
- [x] Auto-switch rule: picking a frame (or entering crop mode) jumps to Frame; picking a spread keeps the user's tab; default tab Frame
- Dropped: name / meta header and the radio `Inspector tab` control (`inspector-name` removed; `inspector-tab-<id>` now ids the tab buttons, `inspector-panel-<id>` the panels; `panel-collapse-right`, `inspector-panel` kept)

**Done when:** the inspector header and tab strip read as the kit `InspectorPanel`; no blue, no black chrome.
**Browser check:** open a book, open the inspector: Frame / Spread / Book; select a frame → Frame; Book shows the book grid; Hide inspector via button, `]` and `I`.
**Perf:** no new per-frame work; panel still subscribes to selection and the book snapshot only.

- **Kit components:** `InspectorPanel`, `EmptyInspector` (`uikit/src/sandbox/inspector.tsx`); `Tabs` / `TabList` / `Tab` size sm (`uikit/src/components/ui/tabs.tsx`; `segList` / `segTab` in `uikit/src/sandbox/chrome.tsx` are empty hooks); `IconButton` + `PanelRightClose`; hotkeys `[` `\` `]` / `I` in `chrome.tsx`.
- **Demo:** `inspector` → `uikit/src/features/pages.tsx`
- **Musts:**
  - Tabs `[frame "Frame", spread "Spread", book "Book"]` in that order, default Frame; header row `h-12`, `gap-1.5`, `pl-2 pr-1.5`; tabs `grid flex-1` with `repeat(3, minmax(0,1fr))`; collapse button right of the tabs.
  - Frame tab always present; with no frame it shows the spread summary and "Select a frame to edit it."
  - Tab panels `min-h-0 overflow-y-auto`.
  - Hide inspector (I): both `I` and `]`; not while typing; Space (pan) never toggles.
- **Hard nos:** no new inspector sections (Geometry / Arrange / Align / Rotate / Adjust / Caption / Layout are later packages); no blue / black chrome; no colours outside existing tokens; no fit-crop or grid behaviour change; no left panel / canvas / header / SpreadTemplateBar change; no fake or disabled controls.
- **Tokens:** track `--field`, selected pill `--chrome` + `--shadow-segment`, text `--muted-foreground` / `--foreground`, `--radius-md` / `--radius-xs`; panel BAR surface.
- **Test:** unit — tabs render and switch per selection (none / spread / frame / crop mode), collapse callback; e2e — grid settings use `inspector-tab-book` / `inspector-tab-spread`.
- **Depends:** look-parity-inspector, look-parity-fit-crop, layout-grids-settings

## Done note

Frame / Spread / Book tabs in the inspector header
