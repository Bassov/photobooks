## Implementation

- [ ] 1. `settingsScreenModel.ts`: Interface 5th section (`slidersHorizontal`), D2 note gone; model test.
- [ ] 2. `SegmentedControl`: optional `labelledBy`, `testId`, item `testId`; unit test.
- [ ] 3. `InterfaceSettingsSection.tsx` (§1) + unit test; `SettingsScreen.tsx` branch; "hides Interface" test → shows Interface.
- [ ] 4. `e2e/interface-size-settings.spec.ts`: IS1 values + paint, IS2, IS4 hint; `library-screens.spec.ts` nav count 5.

## Manual test scenarios

1. 1440×900: Library → Settings → Interface: 100 % selected, normal hint; press 125 % → 125 stays selected, clamp hint "Window too small for 125%: showing 100%.", focus on the segment.
2. Arrow keys move the choice and apply at once; no Save button, no toast.
