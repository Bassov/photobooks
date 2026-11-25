## Proposal

Roadmap: `docs/roadmap/P5/qa-stale-chunk.md` (scope / Done when / Browser SoT).

### Scope out

- `src/editor/SitePreview.tsx` internals (lane qa-preview-cover), `EditorTopBar.tsx`, `Pasteboard.tsx`, `uikit/`.
- Service worker / chunk prefetching or keeping old chunks on deploy.

### Delta / Risk

- A reload of a session book (no library) would lose it: no automatic reload there, the "Reload" error is shown (empty / happy / Esc locked by e2e).
- Worker now runs for non-navigation asset misses only; matched assets stay worker-free (Workers Free quota unchanged in practice).
