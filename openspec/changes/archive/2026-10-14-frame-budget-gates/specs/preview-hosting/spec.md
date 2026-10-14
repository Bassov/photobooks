## ADDED Requirements

### Requirement: Cross-origin isolation headers

Production and preview hosts SHALL send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` on SPA responses so the document can become cross-origin isolated while allowing credentialless cross-origin subresources (for example fonts).

#### Scenario: Isolated document on preview

- **WHEN** a user loads the SPA shell from a production or preview HTTPS URL
- **THEN** the document has `crossOriginIsolated === true`

#### Scenario: Local preview matches isolation headers

- **WHEN** the Vite preview server used by automated tests serves the SPA shell
- **THEN** responses include the same COOP and COEP values and the document has `crossOriginIsolated === true`
