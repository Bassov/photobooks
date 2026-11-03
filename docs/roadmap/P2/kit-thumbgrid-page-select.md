# kit-thumbgrid-page-select

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item kit-thumbgrid-page-select

## Scope

- [x] Kit `TemplateBar` (`uikit/src/sandbox/chrome.tsx`) ThumbGrid selects the base thumb of a page-variant id (`<id>@page`, page 1), as prod LayoutSection and the kit inspector picker do; page 1 applies the page variant
- [x] Every other kit caller that builds or compares `selectedKeys` / `@page` ids is listed in the PR body as fixed or unchanged with a reason
- [x] Kit `Stack` (`uikit/src/sandbox/viewport.tsx`) centres the current spread on remount (Masters → Pages) even when it is fully in view, as prod does (Designer r17 Decided)
- **Done when:** kit qa: page 1 template → its tile has the selected style (DOM box-shadow = `shadow-tile-select`); Masters → Pages → current spread centred (scrollTop measured, numbers in the PR body); `#/demo` baselines unchanged or the diff explained; kit qa + typecheck + unit green, full e2e at the end
- **Perf:** N/A — one ref read per Stack effect
- **Browser check:** `/uikit/#/demo` editor: page 1 → apply a layout → its tile is ringed; zoom out, pick spread 4–5, Masters → Pages → 4–5 centred
- **Hard nos:** no `src/` edits; no `uikit/src/features/site-*`, `library.tsx`, presentation overlay files, roadmap tooling / RULES.md; no new tokens
- **Source:** Designer parity note + r17 Decided (kit-pending), brief 2026-11-04
