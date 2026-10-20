## Decisions

1. **React Aria Components** (already in app deps): thin wrappers in `src/ui/` — `Button`, `IconButton` (+ `Tooltip`/`TooltipTrigger`), `ToggleButton`, `SegmentedControl`, `Toolbar`. Plain CSS + Theme B tokens only (no Tailwind/cva port from kit).
2. **Variants:** public props use inventory names from `docs/design.md` — Button `default` | `secondary` | `ghost` (roadmap “primary / secondary / quiet”); sizes `sm` | `md` (inventory default→`md`). IconButton sizes `sm` (28) / `md` (32); `label` is accessible name and tooltip text (shortcut string included by callers). Record the alias in `docs/design.md` migration note.
3. **SegmentedControl** = single-select `ToggleButtonGroup` (muted track, raised selected pill — kit Segmented look via tokens). **Toolbar** = Aria `Toolbar` (roving focus).
4. **States** from inventory for these primitives: default / hover / focus-visible / pressed / selected / disabled / loading (`isPending` on Button). Specimen shows each.
5. **dependency-cruiser** rule `ui-is-presentational`: `src/ui` must not import `src/core|editor|project`. Session wiring stays in `src/main.tsx` (injected into `mountPhotobooks`). Touch-set includes `.dependency-cruiser.cjs` + `mountPhotobooks` / `main`.
6. `skip_specs: true` — UI chrome only (`.skip-specs`).

## Touch-set & Test Plan

- Files: `src/ui/{Button,IconButton,ToggleButton,SegmentedControl,Toolbar,Tooltip}.{tsx,css}`, `SpecimenPage.*`, `mountPhotobooks.tsx`, `src/main.tsx`, `docs/design.md` (app Button alias note), `.dependency-cruiser.cjs`, `.skip-specs`, roadmap item; unit tests; e2e specimen if needed.
- Reuse: existing `Icon`, tokens, `?specimen` mount; kit behavior as visual/a11y reference only (no uikit imports — `src-no-uikit`).
- Tests: unit via public props (variants, disabled/pending, tooltip label, segmented onChange, toolbar role); e2e empty + painter + specimen actions; `ui-review` before archive; `pnpm deps` / `pnpm check`.
