## Decisions

1. **Drag hint (M38).** `isStatusPillVisible` (only `STATUS_FRAME_DRAG`) sets `data-pill`, styled as kit `StatusLine`; the status stays a clipped live region otherwise. A filled frame is always `draggable` and the move gesture is empty-frame only (kit `useDrag` wins over the move at step 17).
2. **Canvas-centred group (M39).** Top bar is a 5-track grid: `minmax(0, --panel-left − pad) 1fr auto 1fr minmax(0, --panel-right − pad)`; start group spans 1–2, end group 4–5. Equal fr tracks centre the group between the panel widths and give way (no overlap) when a side needs room. Widths, not open state: the kit group stays when the inspector closes.
3. **Menu rows / dot (M40, M41).** Shared `src/ui/Menu`: `line-height: var(--leading-menu)` (new token 1.45 = kit `--text-sm--line-height`, scoped to menus). Single selection renders Lucide `circle` (new glyph) at 8 px, `fill: currentColor`; multiple keeps the check. Look only: `docs/design.md` + `chromeParity` test, no spec delta.
4. **Floor labels (M42).** Threshold stays `PAGE_LABELS_MIN_GAP_PX` = 8 + 11. Mid gesture `writeCameraFrame` sets `data-gap-short` when `gapPx × scale` fails `pageLabelsFit` (CSS `display: none`), cleared with the frame.

## Touch-set & Test Plan

- Files: `src/editor/{editorStatus,EditorShell,EditorShell.css,frameGesture,EditorTopBar,PageLabels,Pasteboard,usePasteboardCamera}`, `src/render/SpreadView.tsx`, `src/ui/{Menu,Menu.css,icons/glyphs}`, `styles/tokens.css`, `docs/design.md`.
- Unit: pill only for the hint; selected filled frame not moved / draggable; dot vs check; live-gap hide/show/clear; threshold below / at / above.
- e2e: new `design-r4-polish.spec.ts`; M20 assertions in `design-r3-chrome` / `design-r2-toolbar-kitset` move to the canvas-centre rule. Skill `ui-review` before push.
