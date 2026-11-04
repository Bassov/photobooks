## Proposal

Roadmap: `docs/roadmap/P2/parent-guides-prod-overhang.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/demo` (`GuideLine`).

### Scope out

- No kit, `src/render/**`, `parentSpreads.ts` or `resolveSpread.ts` edits; guide line geometry unchanged (24 px, PG1).
- Frames stay clipped as today.

### Delta / Risk

- Guides now paint above the group-box outline (accepted). No page-level H/V scroll; the pasteboard stays the only scrollport.
