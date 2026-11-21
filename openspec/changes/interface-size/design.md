## Decisions

1. Reuse `src/ui/uiScale.ts` unchanged: `useUiScale()` → `{ choice, effective }`, `setUiScaleChoice(step)`. Segment ids `'100' | '125' | '150'` map to `UI_SCALES`; clamped = `effective < choice`.
2. `SegmentedControl` gains optional `labelledBy` (group `aria-labelledby`), `testId` (group) and item `testId` (segment `<label>`); existing usages render byte-identical (IS10).
3. `InterfaceSettingsSection` reuses the Site section shell (intro, `bg-chrome` card, `row` prop, Site `LABEL` / `HINT` classes) with `SegmentedControl size="md"` `w-56`; the hint is `aria-live="polite"`, `text-foreground` when clamped. Tokens / primitives from `docs/design.md`: `bg-chrome`, `text-muted-foreground`, `text-foreground`, `SegmentedControl` (kit Segmented). Skill `ui-review` runs before push.
4. Narrow main < 704: the card wrapper is an `@container`, the row wraps with `@max-[704px]:` utilities (the `HostingSetup` pattern). `onChange` calls `setUiScaleChoice` directly: no Save, toast or history; focus stays on the controlled radio. Empty state: N/A (a choice always exists).

## Touch-set & Test Plan

| File                                           |
| ---------------------------------------------- |
| `src/editor/settingsScreenModel.ts`            |
| `src/editor/settingsScreenModel.test.ts`       |
| `src/editor/SettingsScreen.tsx`                |
| `src/editor/SettingsScreen.test.tsx`           |
| `src/editor/InterfaceSettingsSection.tsx`      |
| `src/editor/InterfaceSettingsSection.test.tsx` |
| `src/ui/SegmentedControl.tsx`                  |
| `src/ui/SegmentedControl.test.tsx`             |
| `e2e/interface-size-settings.spec.ts`          |
| `e2e/library-screens.spec.ts`                  |

- Unit: 5 sections; Settings shows Interface, one radiogroup, hint; section stores the choice, clamp wording + ink; new SegmentedControl props.
- e2e: IS1 geometry + paint, IS2, IS4 hint, no page-level scroll; `library-screens` nav count 4 → 5.
