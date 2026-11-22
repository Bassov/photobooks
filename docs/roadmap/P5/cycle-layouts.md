# cycle-layouts

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item cycle-layouts
Status: done

## Scope

Designer Spec cycle-layouts CL3 (prod), item 3 of 3 (core CL1 #651, kit CL2 #707 merged). Owner Q-27: a pill above the
active spread plus ⇧[ / ⇧] cycles the layouts with the same photo count (Decisions D1–D8). Prod `src/` only, no `uikit/`.

- [ ] `src/editor/layoutCatalog.ts`: `pickerLayouts(book, spreadIndex, spread, saved)` → `{ items, aliases }` (moved from
      the `LayoutSection.tsx` memo, no visual change), `cycleSet` (picker order, N photo slots, My templates of this shape,
      no contact sheets) and `stepLayout` (wraps; Custom → › set[0], ‹ set[last]).
- [ ] `src/editor/LayoutCycle.tsx` + `LayoutCycle.css`: `.layout-cycle` pill (`role="group"`, `aria-label="Layout"`, h 28,
      radius 8, `#E1E1E1`, ‹ › 24×24 with top-bar tooltips "Previous layout ⇧[" / "Next layout ⇧]", stable-width name grid,
      `i/n`, visually hidden live text), camera-locked in the active slot: centre x = paper centre, bottom = paper top − 8;
      it stops `pointerdown` from reaching the pasteboard, the wheel passes through.
- [ ] Visibility: Pages mode, active spread, not Preview, no asset drag / frame gesture / marquee, crop not pinned, no text
      edit, N ≥ 1, set ≥ 2, and room above (`LAYOUT_CYCLE_MIN_GAP_PX = 63`, slot 0 always); zero lag in a live zoom.
- [ ] ‹ / › and ⇧[ / ⇧] apply the previous / next layout through
      `dispatchBookOp(op, 'cycleLayout:<spreadId>', 'Change layout')`: selection kept, presses coalesce into one undo step,
      keys also act when the pill is hidden for room; bare `[` / `]` still toggle the panels.
- [ ] Tests: `layoutCycle.test.ts` (PBT), `LayoutCycle.test.tsx`, `e2e/cycle-layouts.spec.ts`; Spec "Tests" list stays
      green unchanged.
- **Browser check:** prod 1440×900 Fit, spread 2–3: pill centre x 676 ±0.5, bottom = paper top − 8 ±0.5, h 28; ⇧] changes
  the layout while `]` still toggles the inspector; three presses then Ctrl+Z = one step; fit / adjust / caption kept; pill
  hidden at gap < 63, in Masters, in Preview and during an asset drag.
