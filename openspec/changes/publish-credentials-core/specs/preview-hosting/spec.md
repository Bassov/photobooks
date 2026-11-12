## ADDED Requirements

### Requirement: Content Security Policy limits outbound connections

Production and preview hosts SHALL send a `Content-Security-Policy` with `connect-src 'self' https://*.r2.cloudflarestorage.com`, `script-src 'self'`, `object-src 'none'`, `base-uri 'self'` and `frame-ancestors 'none'`, so a page script can talk only to its own origin and R2.

#### Scenario: Other origins are blocked

- **WHEN** the app is served with the `public/_headers` policy and a script fetches another origin
- **THEN** the fetch fails with a CSP violation, an R2 endpoint fetch is allowed, and loading the app raises no violation
