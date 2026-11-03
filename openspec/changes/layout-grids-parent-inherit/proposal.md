## Proposal

Roadmap: `docs/roadmap/P2/layout-grids-parent-inherit.md` (scope / Done when / Browser / Perf SoT). UI ref: Designer Spec `layout-grids-parent-inherit` (GP1–GP6, GP9), `uikit#/feature/layout-grids-settings`.

### Scope out

- Core re-align ops and the GP8 perf gate (#418); used, not rewritten.
- Multi-select lane files, kit `demo-parts/*`, new `#/demo` steps.

### Delta / Risk

- Spread Grid Custom adopts the kit GridFields look with per-field source and ↺. Observable: Use master summary (empty), Custom override + ↺ (happy), master edit → inheritors follow (interact). No page-level H/V scroll; the inspector scrolls only inside its panel.
