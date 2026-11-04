## Decisions

1. Cause: `.pasteboard-slot` paint containment (kept for perf) clips at the slot box (page top / sides, page bottom + gap); it gets `overflow-clip-margin: var(--guide-overhang)` (24 px, one var in `Guides.css`). Masters canvas has no clipping ancestor.
2. The paper keeps today's clip via `clip-path: inset()` with `--slot-pad` below; a single page's empty half stays inside.
3. With the editor layer, `ConnectedSpreadView` renders `.spread-stage` holding `SpreadView` and `GuidesOverlay` as its sibling (Preview: bare `SpreadView`); guide gestures find the paper via the stage and append the pull preview there.
4. No token change (`--guide`, `--parent-soft`); `ui-review` before push.

## Touch-set & Test Plan

| Path                                             | Why                 |
| ------------------------------------------------ | ------------------- |
| `src/editor/ConnectedSpreadView.tsx`             | stage wrapper       |
| `src/editor/GuidesOverlay.tsx`                   | paper via stage     |
| `src/editor/guideGesture.ts`                     | preview in stage    |
| `src/editor/Guides.css`                          | overhang var, stage |
| `src/editor/EditorShell.css`                     | slot margin, clip   |
| `src/editor/*.test.ts(x)`                        | stage DOM           |
| `e2e/guides-overhang.spec.ts`                    | new e2e             |
| `e2e/parent-spreads-guides.spec.ts`              | locators via slot   |
| `docs/roadmap/P2/parent-guides-prod-overhang.md` | item from brief     |

- Reuse: `openSessionEditor`, painter fixture `?fixture=painter&parent=a`, `dispatchCtrlWheel`.
- Unit: guides layer inside the stage, outside `spread-view`; Preview has no stage; pull preview in the stage.
- e2e: empty (no guides, no line), happy (overhang on 4 sides: own, parent, Masters, single page), interact (pull, zoom in); paper clip; `assertDocumentFitsViewport`.
