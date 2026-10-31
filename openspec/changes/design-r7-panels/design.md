## Design

Touch set: `src/editor/LayoutSection.tsx`, `Inspector.tsx`, `EndpaperSection.tsx` (+ `EndpaperCanvas.css`), `Filmstrip.tsx` + new `filmstripWheel.ts`, `PresentationMode.tsx`, `src/render/SpreadPager.tsx`, `EditorShell.tsx`.

- M47: the suggested list is the first three builtins whose slot count equals the photo count, current layout included (`aria-pressed`). On a single page One per page is one framed slot, so page 1 lists Full bleed, One per page, Panorama.
- M48: the Inspector header row renders only for Spread / Photo; the Endpaper context opens on its own kit head (`px-4 pt-4 pb-1`).
- M50: `installFilmstripWheel` (non-passive `wheel` on the strip scrollport) adds the dominant delta (line / page modes scaled) to `scrollLeft` and calls `preventDefault`, so the page never scrolls; the canvas camera listens on the pasteboard only, so the strip wheel never zooms.
- M53: Preview's pager position starts at 0 = the cover ("Cover"), then spreads "1 / N".
- M54: the `panel-collapse-right` button is removed; `toggle-r` and the `I` hotkey stay.

No new subsystem, no schema change, no security surface.
