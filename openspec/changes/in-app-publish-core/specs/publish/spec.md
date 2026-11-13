## ADDED Requirements

### Requirement: Publish uploads the site from a worker

A publish worker SHALL build and hash the site, read the R2 credentials from IndexedDB itself and upload against the remote manifest `_photobooks/publish-manifest.json`: puts 4 at a time with assets, then JSON, then HTML finished group by group, then deletes of old-manifest keys only, then the manifest. Transient failures (network while online, 408, 429, 5xx, 30 s timeout) MUST be retried up to 3 attempts after 1 s and 3 s; 403 / 404 / offline MUST NOT. A failed run MUST write the manifest of what is on R2. Content-hashed keys get `public, max-age=31536000, immutable`, other files `no-cache`, the manifest `no-store`. Credentials MUST NOT cross `postMessage`; a `key` / `denied` / `bucket` failure or a success updates the hosting status.

#### Scenario: Retry after a failed run sends only the rest

- **WHEN** one asset PUT fails with 503 three times and publish runs again
- **THEN** the second run puts only the keys the first did not, and deletes no key outside the old manifest

#### Scenario: Bad key marks hosting unreachable

- **WHEN** a publish gets 403 `InvalidAccessKeyId`
- **THEN** it fails with code `key` without retrying, the hosting status turns failed, and no posted message contains the key id or secret
