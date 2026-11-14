## Implementation

- [x] 1. `hostingSetupModel.ts` + unit / PBT (token format, subdomain rule, host, discovery view, row states).
- [x] 2. `HostingSetup.tsx`: three-step card over `discover` / `runSetup` (R2 off, no zone, failures, Try again, Cancel, unmount abort) + component tests.
- [x] 3. `HostingSection.tsx`: mode switch and links, intro, connected setup lines, Forget to origin, help steps `hosting-help-step-N`; update `HostingSection.test.tsx`, `SettingsScreen.test.tsx`.
- [x] 4. `leakGuard.pbt.test.ts`: no setup token in IDB / localStorage / DOM / URL after success, failure and cancel.
- [x] 5. e2e: new `hosting-setup.spec.ts` (flows, kit = prod DOM, paint, LoAF); `hosting-settings.spec.ts` and `in-app-publish.spec.ts` updated.

## Manual test scenarios

1. Settings → Hosting (not connected): setup card at step 1, Continue disabled until a token is pasted; `hosting-manual` opens the manual form, `hosting-guided` returns.
   - problem (harness): manual-qa blocked at welcome — `start-session` click intercepted by the welcome header; scenario covered by `e2e/hosting-setup.spec.ts` and `e2e/hosting-settings.spec.ts` (green locally).
