# interface-size-modals

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item interface-size-modals
Status: done

## Scope

- [x] Item 2b of Designer tool 6 `interface-size` (Owner Q-28): spec §4 second bullet (modal overlays) and the dialog part of Must IS5. Lanes split from item 2: popovers (`interface-size-popovers`) and pointer maths (`interface-size-pointer`) are not here.
- [x] `src/ui/Dialog.tsx`, `src/ui/AlertDialog.tsx`, `src/ui/dialogOverlay.ts`, `src/ui/Toast.tsx` (+ their CSS): `zoom: var(--ui-scale)` on the overlay root, so modal dialogs, alert dialogs and the toast region render at app scale (Print / Export site / Publish / Relink inherit it). A caller that sets its own overlay root is listed in the PR body.
- **Done when:** new `e2e/interface-size-modals.spec.ts`: at 3840×2160 with `photobooks.ui.scale.v1` = `"125"` and `"150"`, the Create book dialog, the Print dialog, an AlertDialog and a toast have rects = R(s) ±0.5 px (R(s) = the same state at 100 % in a viewport of W/s × H/s, values × s), are centred / positioned as at 100 % and lie inside the viewport; IS10: at 100 % nothing changes and existing unit / e2e specs pass untouched.
- **Browser check:** 3840×2160 with `localStorage["photobooks.ui.scale.v1"] = "150"`: Create book and Print dialogs, a confirm dialog and a toast appear 1.5× larger, centred as at 100 %.
- **Hard nos:** `uikit/**`, `src/ui/Popover*`, `src/ui/Menu*`, `src/ui/Select*`, `src/ui/ListSelect*`, `src/ui/Tooltip*`, `src/ui/PanelSplitter.tsx`, `src/editor/**`.
- **Test:** `e2e/interface-size-modals.spec.ts` (new).
- **Depends:** interface-size-core.
