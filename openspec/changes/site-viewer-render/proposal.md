## Proposal

Roadmap: `docs/roadmap/P3/site-viewer-render.md`. Design: site-viewer spec §6, §8.

### Scope out

- `src/site/`, export code, `uikit/`, `parentSpreads.ts` / `resolveSpread.ts`.
- Any look change: editor, Preview and library DOM stay the same.

### Delta / Risk

- Refactor only, `skip_specs: true`: `imageFor` has no product caller yet; existing cover, library and Preview tests and baselines lock the DOM, no re-baseline.
- CSS order: `CoverCanvas.css` moves but keeps its import position.
