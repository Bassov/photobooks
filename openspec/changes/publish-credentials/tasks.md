## Implementation

- [ ] 1. `settingsScreenModel.ts`: Hosting (`keyRound`) at nav index 1; `SettingsScreen.tsx` renders `HostingSection`; model test.
- [ ] 2. `HostingSection.tsx` form: five fields per the Spec table, live validation, Connect enable / Enter, Checking state (readOnly, loader, `aria-busy`, stable width), failures in the footer with rings and help step 3, Help with CORS JSON (`location.origin`) and Copy.
- [ ] 3. Connected card: six rows, badge, Check again (stores result), Replace (prefill, focus key, Cancel), Forget confirm → empty form focused on Account ID.
- [ ] 4. Unit tests in `SettingsScreen.test.tsx` (fake IndexedDB + fetch): nav, form, connect success / failure, secret never in DOM, recheck, replace, forget.
- [ ] 5. e2e: `library-screens.spec.ts` nav count 3; new `hosting-settings.spec.ts` (7 Spec cases, paint check of the error ring, zero LoAF while saving).

## Manual test scenarios

1. Settings → Hosting: empty form, type invalid values (errors), valid values → Connect → Checking… → connected card (R2 routed).
2. Connected: Check again, Replace → Cancel, Forget → confirm → empty form.
