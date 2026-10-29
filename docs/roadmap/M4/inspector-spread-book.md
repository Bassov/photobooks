# inspector-spread-book

Tag: feature
Milestone: M4
Title: look parity: inspector Spread and Book tab sections (Layout / Layout grid; Book settings + grid)
Status: done

## Scope

Look parity, Phase B #3 (Owner 2026-10-29: the editor must look exactly like the UI kit; no fake or disabled controls — omit what has no real data). The visual subset of [`inspector`](../P2/inspector.md) (which stays open as the full feature), following [`look-parity-inspector-tabs`](look-parity-inspector-tabs.md) and [`inspector-frame-sections`](inspector-frame-sections.md).

- [x] Spread tab order: Layout (templates) → Layout grid; the spread rows stay on top
- [x] Layout section (kit `LayoutSection`): template tiles with a thumbnail and name, the current one highlighted; contact-sheet columns × rows + apply; all through `applyTemplate` (undoable)
- [x] Layout grid on the Spread tab: kit `GridSection` with the eye toggle; toggle colours on / off from tokens (#A8A8A8 / #CACACA)
- [x] Book tab: Book settings (page size, bleed, safe margin, pages — read-only rows from the model) + Book grid
- [x] Tokens `--toggle-on` / `--toggle-off` (and `--swatch-ring`, reserved for Background) in the editor chrome tokens
- Background swatches are NOT rendered: the model has no spread background field (no new model fields in this package). They land with the item that adds the field.
- The dock `SpreadTemplateBar` stays for now: it also carries "Add spread", and removing its mount from `Pasteboard.tsx` (rulers area, open PR #274) is not a one-line edit. Removal is deferred until #274 merges.
- Omitted (no real data): My templates, template search / photo-count chips, Save as template, hover preview, Cover / Endpaper / Last-page nodes, paper / print / default-master rows.

**Done when:** the Spread tab shows Layout → Layout grid and the Book tab shows Book settings + Book grid in kit look; applying a template from the inspector changes the spread; no blue, no black chrome, no fake controls.
**Browser check:** Spread tab → click a layout tile → the spread re-flows, Ctrl+Z undoes; contact sheet 3×2 applies; grid eye toggles the overlay; Book tab shows the page size and the book grid fields.
**Perf:** sections subscribe to the book snapshot / the active spread only.

- **Kit components:** `LayoutSection`, `TemplateTile`, `SpreadBgSection` (omitted), `GridSection` (`uikit/src/sandbox/context-inspector.tsx`, `sections.tsx`), `BookInspector` "Book settings" (`v7.tsx`); `Section` (`components/app/ui`).
- **Demo:** `inspector` → `uikit/src/features/pages.tsx`
- **Musts:**
  - Spread tab order Layout → Background → Layout grid (Background omitted, see Scope).
  - Templates live only in the inspector Layout section (dock removal deferred, see Scope).
  - Book tab: Book grid + settings that exist in the model; nothing invented.
  - Swatch ring 2px #8E8E8E, 2px offset (token only, no swatches yet); toggles on #A8A8A8, off #CACACA.
- **Hard nos:** no fake / disabled / placeholder sections; no blue; black only on the canvas selection; no floating FrameToolbar; no change to the Frame tab sections; no fit-crop or grid behaviour change; no Cover / Endpaper / Last-page work; no new model fields.
- **Tokens:** `--toggle-on` #A8A8A8, `--toggle-off` #CACACA, `--swatch-ring` #8E8E8E; fields `--field`; selected tile `SEL`; muted text `--muted-foreground`.
- **Test:** unit — Spread / Book tab section order and visibility, Book tab shows only real settings, template tile applies and marks the current one, toggle colours via tokens; e2e — apply a template from the inspector, toggle the layout grid (scope by test id, never a bare `pressed: true` button).
- **Depends:** look-parity-inspector-tabs, inspector-frame-sections, layout-grids-settings, layout-grids-render-snap, spread-reorder-retemplate, template-slot-aspects

## Done note

Spread tab Layout + Layout grid, Book tab settings + grid; Background and dock removal deferred
