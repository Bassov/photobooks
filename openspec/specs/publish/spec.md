# publish Specification

## Purpose

Publishes the exported static site to the user's own Cloudflare R2 bucket from the browser: SigV4 request signing on WebCrypto, hosting credentials kept only in the editor, and an ordered incremental upload plan. The Settings form is `publish-credentials`; the Publish button and upload loop are `in-app-publish`.

## Requirements

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

### Requirement: Settings → Hosting form and connected card

Settings → Hosting SHALL show the five-field form with live validation (Connect only when valid), then a summary card with Check again, Replace token… and Forget token…. Opening Settings MUST send nothing. The secret MUST NOT enter React state, the DOM after Connect, logs, the URL or localStorage.

#### Scenario: Check failure in the footer

- **WHEN** Connect fails (e.g. CORS)
- **THEN** the footer shows the redacted message, the named fields ring red, a CORS failure marks help step 3, and nothing is stored

#### Scenario: Connect saves and hides the secret

- **WHEN** valid values are entered and R2 accepts the check write
- **THEN** the connected card shows, survives a reload, and the secret appears nowhere in the document, localStorage or URL

#### Scenario: Forget empties the form

- **WHEN** the user confirms Forget token
- **THEN** the stored credentials and status are deleted and the empty form shows with focus on Account ID

### Requirement: Publish uploads the site from a worker

A publish worker SHALL build and hash the site, read the R2 credentials from IndexedDB itself and upload against the remote manifest `_photobooks/publish-manifest.json`: puts 4 at a time with assets, then JSON, then HTML finished group by group, then deletes of old-manifest keys only, then the manifest. Transient failures (network while online, 408, 429, 5xx, 30 s timeout) MUST be retried up to 3 attempts after 1 s and 3 s; 403 / 404 / offline MUST NOT. A failed run MUST write the manifest of what is on R2. Content-hashed keys get `public, max-age=31536000, immutable`, other files `no-cache`, the manifest `no-store`. Credentials MUST NOT cross `postMessage`; a `key` / `denied` / `bucket` failure or a success updates the hosting status.

#### Scenario: Retry after a failed run sends only the rest

- **WHEN** one asset PUT fails with 503 three times and publish runs again
- **THEN** the second run puts only the keys the first did not, and deletes no key outside the old manifest

#### Scenario: Bad key marks hosting unreachable

- **WHEN** a publish gets 403 `InvalidAccessKeyId`
- **THEN** it fails with code `key` without retrying, the hosting status turns failed, and no posted message contains the key id or secret
