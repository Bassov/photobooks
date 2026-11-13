## Implementation

- [x] 1. `settingsScreenModel.ts`: Hosting (`keyRound`) at nav index 1; `SettingsScreen.tsx` renders `HostingSection`; model test. Evidence: `settingsScreenModel.test.ts`, `SettingsScreen.test.tsx` (check:fast green).
- [x] 2. `HostingSection.tsx` form: five fields per the Spec table, live validation, Connect enable / Enter, Checking state (readOnly, loader, `aria-busy`, stable width), failures in the footer with rings and help step 3, Help with CORS JSON (`location.origin`) and Copy. Evidence: `HostingSection.test.tsx` (22 tests).
- [x] 3. Connected card: six rows, badge, Check again (stores result), Replace (prefill, focus key, Cancel), Forget confirm → empty form focused on Account ID. Evidence: `HostingSection.test.tsx`, `hosting-settings.spec.ts`.
- [x] 4. Unit tests in `HostingSection.test.tsx` and `SettingsScreen.test.tsx` (fake IndexedDB + fetch): nav, form, connect success / failure, secret never in DOM, recheck, replace, forget. Evidence: stryker:diff 89.20 %, 0 NoCoverage.
- [x] 5. e2e: `library-screens.spec.ts` nav count 3; new `hosting-settings.spec.ts` (6 tests for the Spec cases, paint check of the error ring, zero LoAF while saving). Evidence: `test:e2e:changed:quiet` OK (24 tests).

## Manual test scenarios

1. Settings → Hosting: empty form, type invalid values (errors), valid values → Connect → Checking… → connected card (R2 routed).
2. Connected: Check again, Replace → Cancel, Forget → confirm → empty form.

- problem (harness): `pnpm agent manual-qa` timed out on `start-session` (welcome header intercepts the click) before Hosting; both scenarios unchecked by the agent.
- OK 1: Playwright walk (`startSessionEditor`, R2 routed) at 1440×900: empty form, bucket `A` → red ring + message, valid → Connect → connected card; covered by `e2e/hosting-settings.spec.ts` (Connect, CORS, Checking, ring paint).
- OK 2: Check again / Replace → Cancel / Forget → empty form covered by `e2e/hosting-settings.spec.ts` and `HostingSection.test.tsx`.
