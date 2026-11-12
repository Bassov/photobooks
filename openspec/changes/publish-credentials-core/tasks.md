## Implementation

- [x] 1. `src/editor/hostingForm.ts` + PBT: trim, endpoint-URL parse, site address normalise, Spec messages, `validateHostingForm` (`src/editor/hostingForm.pbt.test.ts`)
- [x] 2. `src/publish/credentials.ts`: status record, `loadHostingSummary`, `forgetCredentials`; tests (`src/publish/credentials.test.ts`)
- [x] 3. `src/publish/checkConnection.ts`: PUT / HEAD / DELETE check, 15 s timeout, error table, `connectHosting` / `recheckHosting`; mocked-fetch tests incl. secret-free strings and logs (`src/publish/checkConnection.test.ts`)
- [x] 4. Import boundary: no `createCredentialStore` outside `src/publish/` (`src/publish/importBoundary.test.ts`)
- [x] 5. `public/_headers` CSP + `e2e/csp-connect.spec.ts`; zod jitless (`src/lib/zod.ts`, `src/lib/zod.test.ts`)

## Manual test scenarios

N/A — no UI in this item (CSP proven by e2e; Security Review recorded in the PR).
