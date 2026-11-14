## Implementation

- [ ] 1. `hostingBits.tsx`: move `Swap`, `checkingLabel`, `Fail`, `OUTLINE`, `when` out of `hosting.tsx`.
- [ ] 2. `session.tsx`: `HostingRecord` `origin?`, `provisionedAtMs?`, `setupTokenLeft?`.
- [ ] 3. `hostingSetup.tsx`: stepper (markers, summaries, Change), step 1 token + errors + R2-off box, step 2 address + bucket line + no-zone box, step 3 progress rows, Try again / Cancel setup, success → record.
- [ ] 4. `hosting.tsx`: intro, mode switch links, connected lines (C10), Forget → origin; `settings.tsx` `@container`.
- [ ] 5. `pages.tsx`: setup scenarios, `hosting-manual`, edge lines.
- [ ] 6. e2e: `kit-hosting-settings.spec.ts` (manual-first + KS setup tests with paint checks), `kit-in-app-publish.spec.ts`.

## Manual test scenarios

1. Kit `#/full/site-settings` → Not connected: paste a token → Continue → Checking… → step 2 → Set up hosting → rows tick → connected card with "Set up automatically" and "New address".
2. Subdomain `taken` → row 3 fails in #a8403a → Try again resumes at row 3; Cancel setup → step 2.
3. "Already have a bucket?" → manual form; "Set up automatically instead" → back with the typed subdomain kept.
