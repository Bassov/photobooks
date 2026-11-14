## Proposal

Roadmap: `docs/roadmap/P5/connect-own-hosting.md`. UI ref: `uikit#/feature/site-settings` (`hosting-setup-*`, `hosting-manual`).

### Scope out

- Kit, relay and core rewrites; a provider choice.

### Delta / Risk

- e2e covers empty (step 1) / happy (→ connected) / interact (Try again, Cancel, manual link); no page-level scroll, settings scrollport only.
- Security: the setup token goes to Cloudflare only as the relay's `Authorization` header (messages redacted) and never reaches React state, the DOM, IndexedDB, localStorage or the URL.
