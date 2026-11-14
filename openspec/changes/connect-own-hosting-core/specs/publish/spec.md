## ADDED Requirements

### Requirement: Guided setup discovery

The system SHALL reach Cloudflare only through the same-origin `/api/cf/*` client (15 s timeout, coded errors, redacted messages) with one in-memory setup token (Workers R2 Storage · Edit, Zone · Read, API Tokens · Edit), and SHALL discover the accounts, active and pending zones, whether R2 is on and the buckets. The setup token MUST NOT reach IndexedDB, localStorage, the URL or logs.

#### Scenario: R2 is off

- **WHEN** listing buckets answers code 10042
- **THEN** discovery reports R2 off instead of failing

### Requirement: Resumable guided provisioning

Setup SHALL run six idempotent rows (bucket `pb-<host>`, CORS, custom domain, a bucket-item key as S3 keys, a check write with CORS retried every 5 s for 30 s, deleting the setup token), resumable from any row, and SHALL store the record only after the check passes, with `origin: 'setup'`, `provisionedAtMs` and `setupTokenLeft`. A record without `origin` reads as manual.

#### Scenario: Try again resumes at the failed row

- **WHEN** row 3 failed and setup runs again from row 3
- **THEN** rows 1–2 send no request and an "already attached" domain counts as done

#### Scenario: Token delete failure is not fatal

- **WHEN** deleting the setup token fails
- **THEN** the record is stored with `setupTokenLeft` and setup completes
