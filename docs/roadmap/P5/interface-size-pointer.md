# interface-size-pointer

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item interface-size-pointer
Status: done

## Scope

- [ ] Item 2c of Designer tool 6 `interface-size` (Owner Q-28): spec §4 pointer maths, DPR readers and site preview (bullets 3–8); Musts IS6, IS8, IS9, IS10. Popovers and modals are sibling lanes (`interface-size-popovers`, `interface-size-modals`); no Settings UI, no kit.
- [ ] Pointer deltas written as CSS px divide by `uiScale()`: `src/ui/PanelSplitter.tsx` and the filmstrip resize separator.
- [ ] `src/editor/FrameContextMenu.tsx` paste point: the `getBoundingClientRect` box and `pxPerMm` in one space.
- [ ] `src/editor/Rulers.tsx` and `src/editor/spreadPreviewKeys.ts` read `effectiveDpr()` (DPR × s) instead of `devicePixelRatio`.
- [ ] `src/editor/SitePreview.tsx` `.site` area gets `zoom: calc(1 / var(--ui-scale))` (D6): the Preview bar scales, the site room stays at visitor size.
- [ ] IS6 audit e2e at 150 % (3840×2160): frame drag, resize handle, crop pan, marquee, guide drag, panel splitter, spread-list reorder, filmstrip drag → drop target, wheel-zoom anchor; screen movement = pointer movement ±1 px. Audit files with no code change when the audit passes.
- **Done when:** `e2e/interface-size-pointer.spec.ts` pins IS6 (every listed gesture ±1 px at 150 %), IS8 (rulers canvas backing = css × DPR × s; frame image tier from DPR × s) and IS9 (Preview bar 48·s, site room at 100 % visitor values, GL canvas DPR 1 at 4K); unit tests pin the changed maths; IS10: at 100 % existing unit / e2e / design specs pass untouched. An audit gesture failing in a file held by open PR #666 (`cropGesture.ts`, `frameHandleGesture.ts`, `photoGesture.ts`) is `test.fixme` with a note and listed as a follow-up in the PR body.
- **Browser check:** 3840×2160 with `localStorage["photobooks.ui.scale.v1"] = "150"`: drag the panel splitter 40 px → panel width changes by 40 screen px; open Preview → bar 72 px tall, site room drawn at visitor size.
- **Hard nos:** `uikit/**`, `src/ui/{Popover,Menu,Select,ListSelect,Tooltip,Dialog,AlertDialog,Toast}*`, `src/ui/dialogOverlay.ts`, `src/editor/EditorShell.tsx`, `src/editor/bookHistory.ts`, `src/editor/editorStatus.ts`, `src/editor/{cropGesture,frameHandleGesture,photoGesture}.ts`.
- **Test:** `e2e/interface-size-pointer.spec.ts` (new); unit tests beside the changed files.
- **Depends:** interface-size-core.
