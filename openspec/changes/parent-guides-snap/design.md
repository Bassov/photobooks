## Decisions

1. Snap guides come from what the spread shows: `spreadContext` (`src/editor/frameGesture.ts`) passes `[...book.guides, ...viewGuides(book, index, spread).map((g) => g.guide)]` to `buildSnapIndex`. `viewGuides` holds parent (on-page mm, hidden / overridden dropped), local copies and own guides, so it replaces `spread.guides`; on the Masters canvas it returns the parent's own guides, as `GuidesOverlay` does. Parent guides are plain `Guide`s, so kind `guide`, pull, line and pill are unchanged (`snapIndex.ts` untouched).
2. Visibility gate: no guides while `getGuidesVisible()` is false. Built once per gesture like the grid anchors; Snap off / Alt (`snapBypassed`) untouched.
3. All snap-target callers go through `spreadContext` (draw, move, group move, `frameHandleGesture` resize); `guideGesture.ts` builds no snap index, so it is left out.

## Touch-set & Test Plan

| Path                                                           | Why                                 |
| -------------------------------------------------------------- | ----------------------------------- |
| `src/editor/frameGesture.ts`                                   | snap guide source + visibility gate |
| `src/editor/frameGesture.test.ts`                              | unit cases                          |
| `e2e/parent-spreads-guides.spec.ts`                            | browser check, snap half            |
| `openspec/changes/parent-guides-snap/specs/pasteboard/spec.md` | snap contract delta                 |

- Reuse: `viewGuides`, `getGuidesVisible`, the e2e file's helpers.
- Unit: roadmap draw cases (parent horizontal + vertical mapped onto the single page; hidden → no book / own / parent snap) plus one move case onto a parent guide, covering the shared builder.
- e2e: the roadmap Browser check.
