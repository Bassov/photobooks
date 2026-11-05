# parent-overrides-kit

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item parent-overrides-kit

## Scope

- [ ] Kit `FrameEl` (`uikit/src/sandbox/canvas.tsx`, Designer `parent-overrides` Spec 2026-11-04 PO1 / PO3 / §Kit changes): inherited (parent) frames lose `z-10` and are `pointer-events-none` always (parents paint under own frames, as prod); override copies carry `data-override` and the badge `data-testid="override-badge"` (lucide `Unlink2` + "override") with the fit rule: frame screen `w ≥ badgeW + 8 && h ≥ 24.84` → full; `w ≥ 26 && h ≥ 24.84` → icon-only 18 px (`title` / `aria-label` "Override"); else none; no badge in Preview or on the frame in crop mode.
- [ ] Kit `SpreadSurface`: paint order parent frames → override copies → own frames; Ctrl/⌘+Shift primary press (capture) runs a geometric hit test — parent guide within 4.5 screen px, else the topmost override copy (rotation-aware: select it, move after 3 px, no extra undo step; Designer parent-overrides-canvas review 3), else the topmost parent frame through own frames (copy "Override parent item", selected, press continues as a move); Alt is no override key; a plain press on the paper over an uncovered parent item shows `Parent item from “{name}” — Ctrl+Shift+click to override on this spread`.
- [ ] Kit delete on a copy (Del key, inspector Delete) removes the copy and adds its parent id to `hiddenParent` ("Hide parent item"); z-order (Arrange) is hidden for a copy.
- [ ] Kit guides (`model.ts`, `viewport.tsx`): `Guide.overrides`; `allGuides` drops overridden parent guides; Ctrl/⌘+Shift press on an inherited guide copies it (spread scope, `overrides`) and continues as a drag ("Override parent guide"); removing a copy guide (onto the ruler / off the spread) hides the parent guide.
- [ ] Kit inspector (`context-inspector.tsx`): `InspectorShell` `action` slot; a copy's Photo / Text head shows `Override · {parent}` + ↺ "Reset to parent" (PO6); `SpreadPageSection` lists "Changed from {parent}" rows with per-row ↺ and Reset all (PO7), absent when nothing changed.
- [ ] Demo walk: `editor-parent-item-overridden` uses Control+Shift; new steps `editor-parent-changes`, `editor-parent-reset-all`; kit qa override line → Control+Shift.
- **Done when:** kit DOM: the badge is never clipped by its frame (full / icon / none per the fit rule, live through zoom); kit e2e + demo steps green.
- **Browser check:** `uikit#/demo` editor, spread 2–3 (Master A, full-bleed photo): Ctrl+Shift+click the Chapter line → a copy is selected through the photo, inspector head `Override · Master A`; drag it 30 px; Ctrl+Shift-drag guide `mA-gl` onto the ruler; click the grey → spread inspector lists the copy and the hidden guide; Reset all → both back to the master.
- **Test:** Playwright e2e on `/uikit/#/demo` (paint order, hit test through an own frame, copy reselect without an undo step, badge fit at Fit / zoomed / narrow, Delete hides, guide override / hide, PO6 / PO7 rows and resets); demo baselines of the touched steps.
- **Perf:** N/A (kit sandbox)
- **Hard nos:** kit only, no prod `src/` (prod lanes `parent-overrides*`); no kit canvas context menu; Designer review on the PR (hold).
- **UI kit:** `uikit/src/sandbox/canvas.tsx`, `model.ts`, `viewport.tsx`, `context-inspector.tsx`, `inspector.tsx`, `store.tsx`, `uikit/scripts/demo-capture.mjs`; `UI ref: uikit#/demo`; Designer spec `photobooks-orch/shared/design/parent-overrides/spec.md`.
