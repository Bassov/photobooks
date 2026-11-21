# interface-size

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item interface-size

## Scope

Prod Settings → Interface section with the UI scale choice 100 / 125 / 150 % (design spec interface-size §1, D4, D8;
Musts IS1, IS2, IS4 hint, IS10). Depends on interface-size-core (`src/ui/uiScale.ts`, D4 clamp, storage) and the
overlay / pointer items, all on main. Kit side: interface-size-kit.

- [ ] `src/editor/settingsScreenModel.ts`: 5th section `{ id: 'interface', label: 'Interface', icon:
  'slidersHorizontal' }`; the D2 "hidden" note goes.
- [ ] `src/editor/SettingsScreen.tsx` section branch + new `src/editor/InterfaceSettingsSection.tsx`: §1 exactly (Site
      row geometry, SegmentedControl md `w-56`, test ids `interface-size`, `interface-size-100|125|150`,
      `settings-nav-interface`, label id, hint id with `aria-live`, clamp wording `Window too small for {choice}%:
  showing {effective}%.` in `text-foreground`). Applies at once: no Save, no toast, no undo step; focus and
      Settings scroll kept; the clamped choice stays selected; narrow main < 704 wraps.
- [ ] IS1: at 1440×900 the nav shows Interface 5th; row 68.8 tall, track 224×32, segments 28, hint 12 / 16.8 (e2e,
      ±0.5 px).
- [ ] IS2: the choice applies at once, persists in `photobooks.ui.scale.v1`, survives reload, syncs a 2nd tab; an
      invalid value reads as 100 (e2e).
- [ ] IS4 hint: 1920×970 + 150 → "showing 125%"; 1440×900 + 125 → "showing 100%"; widening restores without a write
      (e2e).
- [ ] IS10: at 100 % existing unit, e2e and design specs pass untouched (the "hides Interface" tests flip to shows).
- Out of scope: `uikit/` (interface-size-kit), `src/ui/uiScale.ts` behaviour.
- **Browser check:** 1440×900, Library → Settings → Interface: pick 125 % → hint "Window too small for 125%: showing
  100%.", 125 stays selected, focus stays on the segment; widen to 1920×1080 → the app zooms 1.25 and the normal
  hint returns. Paint screenshots of the section at 100 % and clamped in the PR body.
