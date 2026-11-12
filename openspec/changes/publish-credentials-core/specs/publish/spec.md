## ADDED Requirements

### Requirement: Hosting form validation

The hosting form SHALL trim its five fields, accept the R2 S3 endpoint URL as the account id (filling an empty bucket) and reject `http:`, `r2.dev`, site addresses with a path and EU / FedRAMP endpoints, with the Designer Spec messages that never echo a value.

#### Scenario: Endpoint URL pasted as account id

- **WHEN** `https://<32 hex>.r2.cloudflarestorage.com/my-books` is entered as the account id with an empty bucket
- **THEN** the account id becomes the lowercase 32 hex and the bucket becomes `my-books`

### Requirement: Connect checks a real write before saving

Connect SHALL PUT, HEAD and DELETE `_photobooks/check-<8 hex>.txt` within 15 s and store the credentials only when all three succeed; failures map to offline, CORS, bad key, access denied, missing bucket, timeout or other, through `redact`. The UI SHALL read only a summary (account, bucket, last 4 of the key id, site address, last check status); Forget SHALL clear every stored value.

#### Scenario: Failed check stores nothing

- **WHEN** Connect gets 403 `InvalidAccessKeyId` from R2
- **THEN** it reports "Cloudflare doesn't recognise this key" on the key and secret fields, nothing is stored, and no message, status or summary contains the secret
