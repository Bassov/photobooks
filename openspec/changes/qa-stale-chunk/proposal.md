## Proposal

Roadmap: `docs/roadmap/P5/qa-stale-chunk.md` (scope / Done when / Browser SoT).

### Scope out

- `SitePreview.tsx` internals (lane qa-preview-cover), `EditorTopBar.tsx`, `Pasteboard.tsx`, `uikit/`.
- Service worker, chunk prefetch, keeping old chunks on deploy.

### Delta / Risk

- Session book (no library) is never auto-reloaded. e2e: error visible over the editor, Esc returns focus to Preview, no page scroll.
- Security: the Worker only rewrites HTML answers under `/assets/*` to 404; headers/CSP unchanged. The guard stores only a timestamp.
