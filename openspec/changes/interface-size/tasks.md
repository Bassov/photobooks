## Implementation

- [x] 1. `settingsScreenModel.ts`: Interface 5th section (`slidersHorizontal`), D2 note gone; model test (`settingsScreenModel.test.ts`).
- [x] 2. `SegmentedControl`: optional `labelledBy`, `testId`, item `testId`; unit test (`SegmentedControl.test.tsx`).
- [x] 3. `InterfaceSettingsSection.tsx` (§1) + unit test; `SettingsScreen.tsx` branch; "hides Interface" test → shows Interface (`SettingsScreen.test.tsx`).
- [x] 4. `e2e/interface-size-settings.spec.ts`: IS1 values + paint, narrow wrap, IS2, IS4 hint; `library-screens.spec.ts` nav count 5.

## Manual test scenarios

1. 1440×900: Library → Settings → Interface: 100 % selected, normal hint; press 125 % → 125 stays selected, clamp hint "Window too small for 125%: showing 100%.", focus on the segment.
2. Arrow keys move the choice and apply at once; no Save button, no toast.

manual-qa (2026-11-21): harness problem, both scenarios: `start-session` click intercepted by the welcome header (30 s timeout), the editor was never reached. Covered instead by e2e `interface-size-settings.spec.ts` (green locally, 7/7): scenario 1 = "IS1 …" (clamped 150 stays selected + focused, clamp hint) and "IS4: 125 clamps to 100 …"; scenario 2 = "IS2: a press or arrow applies at once …" (ArrowRight → 150, focus kept, no button / toast).
