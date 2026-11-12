## ADDED Requirements

### Requirement: R2 request signing

The system SHALL sign R2 S3 requests (PUT / HEAD / DELETE to `https://<accountId>.r2.cloudflarestorage.com/<bucket>/<key>`, region `auto`, service `s3`) with AWS Signature Version 4 on WebCrypto, matching the official AWS SigV4 test vectors.

#### Scenario: Signed upload

- **WHEN** a PUT is built for a key and body
- **THEN** it carries `x-amz-date`, `x-amz-content-sha256` (SHA-256 of the body) and an `Authorization` header whose signature matches SigV4 for those inputs

### Requirement: Hosting credentials stay in the editor

The system SHALL validate R2 credentials (account id, bucket, access key id, secret, https public base URL, no whitespace) and SHALL store them only in the editor-origin IndexedDB database `photobooks-secrets` — never in the library folder, book files, localStorage, URLs or exported site files. Error text SHALL name fields, not values; `redact` SHALL hide the key id and secret (raw, URL-encoded, base64).

#### Scenario: Export never carries the token

- **WHEN** credentials are stored and the site is exported
- **THEN** no exported file contains the access key id or secret in raw, base64 or URL-encoded form

#### Scenario: Viewer never imports credentials

- **WHEN** the import graph of `src/site/**` and the site viewer entry is walked
- **THEN** it never reaches `src/publish/credentials`

### Requirement: Ordered incremental upload plan

The system SHALL plan an upload from the exported files and the last remote manifest (`key → sha256`): put exactly the new or changed keys — assets first, then JSON, then HTML — then delete keys that are only remote.

#### Scenario: Pages after their assets

- **WHEN** a plan includes HTML pages
- **THEN** every asset or JSON put precedes every HTML put, and deletes come last
