## Decisions

1. `Z_MOVES.keys` takes the kit strings; `ArrangeRow` names each `IconButton` `"<label> (<keys>)"`. Both inspector callers (`ArrangeSection`, `SetArrangeSection`) share `ArrangeRow`; the context menu reads the same source.
2. `Rulers.css`: `.ruler-x` `s-resize`, `.ruler-y` `e-resize`.
3. `guideStatus` in `editorStatus.ts` is a pure kit port (`viewport.tsx:222`): page-local mm on two-page spreads and parents, side from `getSinglePageSide` for a single page.
4. `startGuideDrag` sets it on commit (add or move), the one path both entry points (`Rulers.tsx`, `GuidesOverlay.tsx`) share.
5. `isStatusPillVisible` accepts guide statuses. Tokens and primitives per `docs/design.md`: reuses the kit `Status` pill and `IconButton`, nothing new.

## Touch-set & Test Plan

| Path                                | Why                      |
| ----------------------------------- | ------------------------ |
| `src/editor/frameArrange.ts`        | kit key strings          |
| `src/editor/FrameSections.tsx`      | button names             |
| `src/editor/Rulers.css`             | kit cursors              |
| `src/editor/editorStatus.ts`        | `guideStatus`, pill rule |
| `src/editor/guideGesture.ts`        | status on commit         |
| `openspec/specs/pasteboard/spec.md` | delta sync at archive    |

- Unit/DOM: Arrange names (single + set), menu hints, computed ruler cursor (`Rulers.css` injected), `guideStatus` table (spine, right edge, single page, horizontal), drag on a two-page spread → page text; cancel keeps the status.
- e2e: pill text after a ruler drag. `#/demo` baselines and `ui-review` cover the rest of the UI.
