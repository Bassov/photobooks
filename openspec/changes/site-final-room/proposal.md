## Proposal

Roadmap: `docs/roadmap/P4/site-final-room.md` (scope, Done when, Browser, Perf SoT); Designer Spec `personal-site` P5.

### Scope out

- Editor Preview rework and the dead editor `SiteStage` / `SiteCatalog` exports (P6); `SitePreview.tsx` only swaps to `SiteRoom` because the old page is deleted.
- Kit, `src/publish/**`, GL internals (`src/site/book/gl/**`).

### Delta / Risk

- e2e covers happy (room checkpoints), interact (turn, Share, Fullscreen, history) and empty (blank pages give no phone slide); no page-level scroll, the carousel strip is the only scrollport.
- Security: same-origin `book.json` fetch; no new dependency or storage.
