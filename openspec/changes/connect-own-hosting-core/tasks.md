## Implementation

- [ ] 1. `credentials.ts`: provenance fields on the record and summary, `redact` token-run scrub; tests.
- [ ] 2. `cfApi.ts` + `cfApi.test.ts`: request, 15 s timeout, error codes and messages.
- [ ] 3. `provision.ts`: `setupTemplateUrl`, `bucketNameFor`, `deriveS3Keys`, `discover`; tests + bucket-name PBT.
- [ ] 4. `provision.ts`: `runSetup` rows 1–6, resume, Cors retry, record save; tests.
- [ ] 5. `leakGuard.pbt.test.ts`: setup token leak PBT after success, failure and cancel; `index.ts` exports.

## Manual test scenarios

N/A: no UI in this item (the prod UI item runs the browser check).
