# cycle-layouts-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item cycle-layouts-kit
Status: done

## Scope

Designer Spec cycle-layouts CL2 (kit), item 2 of 3 (core CL1 merged in #651, prod CL3 next). Owner Q-27: a pill above the
active spread plus ⇧[ / ⇧] cycles the layouts with the same photo count (Decisions D1–D8). Kit `#/demo` only, no `src/`.

- [ ] `uikit/src/sandbox/templates.ts`: `cycleSet(spread, single, mine)` (picker order, N photo slots, My templates of this
      shape, no contact sheets) and `stepLayout(set, current, dir)` (wraps; Custom → › set[0], ‹ set[last]).
- [ ] `uikit/src/sandbox/layout-cycle.tsx`: `LayoutCycle` pill (`.layout-cycle`, `role="group"`, `aria-label="Layout"`,
      h 28, ‹ › 24×24, stable-width name grid, `i/n`, visually hidden live text), `cycleLayout(st, dir)` (photos, per-frame
      props and selection kept by index, history key `cycle:<spreadId>`, label "Change layout", no status) and
      `useLayoutCycleKeys()` (⇧[ / ⇧] when no typing target; `preventDefault` only when acting; bare `[` / `]` still toggle
      the panels).
- [ ] `uikit/src/sandbox/viewport.tsx`: the pill in the active `Stack` slot (centre = paper centre, bottom = paper top − 8,
      camera-locked), shown when `gap ≥ 63` (slot 0 always); keys installed beside `useEditorKeys()`. Kit `Stack` centres
      page 1 in the 56/48 band on a width-limited Fit of a new book (tracker line 1019, prod `placedScroll`).
- [ ] `uikit/src/sandbox/store.tsx`: history keys starting `cycle:` coalesce with no 1 s window.
- [ ] `uikit/src/sandbox/chrome.tsx` `applyTemplate`: per-frame props kept by index (D6).
- [ ] `uikit/scripts/demo-capture.mjs`: steps `editor-layout-cycle-hover`, `editor-layout-cycle-next`,
      `editor-layout-cycle-undone` after `editor-spread-1`; editor steps that gain the pill re-baselined.
- [ ] Tests: new `e2e/kit-layout-cycle.spec.ts`; `e2e/kit-editor-chrome.spec.ts:665` stays green unchanged.
- **Browser check:** kit `#/demo` 1440×900 Fit, spread 2–3: pill at x 676, y 71.02–99.02; › and ⇧] change the layout; three
  presses then Ctrl+Z restore the first layout in one step.

## Done when

- The pill matches the Spec numbers at 1440×900 Fit on spread 2–3 (±1 px); same width across presses; hidden at gap < 63, in
  Preview and Masters.
- ⇧] applies while `]` still toggles the inspector; 3 presses then Ctrl+Z = 1 step; per-frame props kept.
- `e2e/kit-layout-cycle.spec.ts` and `pnpm test:e2e:quiet e2e/kit-` pass; demo baseline updated only for the pill (and the
  band-centring step if it moves).
