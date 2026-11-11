## Proposal

Roadmap: `docs/roadmap/P4/site-final-gl.md` (scope / Done when SoT). Kit source: PR #558 (not on `main` yet).

### Scope out

- Consumers (home / room), `?gl` fallback wiring, `site-reader-gl.spec.ts`.
- The kit's title page and title fonts: prod faces and cover panels carry their text.

### Delta / Risk

- No UI: verified by unit tests and the e2e probe.
- Security: vendored three r170, no npm dependency; same-origin lazy chunk only.
