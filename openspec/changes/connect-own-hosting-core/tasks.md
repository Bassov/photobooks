## Implementation

- [x] 1. `credentials.ts`: provenance fields on the record and summary, `redact` token-run scrub; tests (`credentials.test.ts`).
- [x] 2. `cfApi.ts` + `cfApi.test.ts`: request, 15 s timeout, error codes and messages.
- [x] 3. `provision.ts`: `setupTemplateUrl`, `bucketNameFor`, `deriveS3Keys`, `discover`; tests + bucket-name PBT (`provision.test.ts`, `provision.pbt.test.ts`).
- [x] 4. `provision.ts`: `runSetup` rows 1–6, resume, Cors retry, record save; tests (`provision.test.ts`).
- [x] 5. `leakGuard.pbt.test.ts`: setup token leak PBT after success, failure and cancel. `index.ts` unchanged: knip rejects unused re-exports; the UI imports `./provision` / `./cfApi` directly.

- [x] 6. Security Review: pass with notes. Fixed: account / token ids from responses must be 32 lowercase hex before they reach relay paths or object keys. Left for the UI/relay items: cancel does not abort an in-flight request; a re-run of row 4 after losing keys leaves the old bucket token (Info).

## Manual test scenarios

N/A: no UI in this item (the prod UI item runs the browser check).
