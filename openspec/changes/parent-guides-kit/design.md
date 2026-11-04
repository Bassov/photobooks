## Decisions

1. `GuideLine` gets a `passive` prop; `SpreadSurface` passes `passive={!!g.inherited && !features.parentEdit}`. Passive lines carry `pointer-events-none` and no `onPointerDown`, so `elementFromPoint` on the line returns the frame or paper below (PG2). Master canvas and own guides stay active.
2. Dash `repeating-linear-gradient(var(--dir), var(--parent-soft) 0 4px, transparent 4px 7px)` (token from `uikit/src/index.css`); overhang `inset-[-24px]` on the long axis for every guide.
3. `viewport.tsx` `onGuideDown` drops the inherited status branch and its `inherited` argument (unreachable once passive); the `SpreadSurface` call site and prop type follow; the parentEdit lookup via `par.guides` stays.
4. Demo step `editor-parent-guides-inherited` after `editor-master-guides-edit` clicks Pages; `editor-master-page-numbers-on` first clicks Masters again (it needs the master inspector), so later screenshots keep their content.

## Touch-set & Test Plan

| File                             | Why                                                                       |
| -------------------------------- | ------------------------------------------------------------------------- |
| `uikit/src/sandbox/canvas.tsx`   | `GuideLine` passive / colour / overhang; `SpreadSurface` passes `passive` |
| `uikit/src/sandbox/viewport.tsx` | drop the inherited status branch                                          |
| `uikit/scripts/demo-capture.mjs` | new step; page-numbers step returns to Masters                            |
| `uikit/scripts/qa.mjs`           | parent-guides DOM checks                                                  |

- Reuse: `allGuides` order (parent → own) keeps own lines on top; tokens `--parent-soft`, `bg-guide`.
- Tests: kit qa parent-guides block per tasks.md #3; demo baselines regenerated into `.cache/agent` (untracked).
