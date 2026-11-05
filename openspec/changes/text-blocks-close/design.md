## Decisions

1. New unit file instead of growing `TextEditOverlay.test.tsx`: the font gate needs `vi.mock('../fonts/loadBookFonts')` with a held promise, and the overlay caches one font load per module, so the gate test must be the first measure in its file.
2. Render isolation is counted with React `Profiler` around two `ConnectedSpreadView`s (same pattern as `ConnectedSpreadView.test.tsx` sibling paint): typing fires `input` on the uncontrolled edit box → zero commits on both spreads; the Esc commit → the edited spread only.
3. Thumbnail parity in e2e (real fonts and layout): compare the workspace and spread-list text node by font family / weight / color / align, font size and box height relative to the frame width (`offsetWidth`, untouched by the camera transform), and the line count from `Range.getClientRects()`.

## Touch-set & Test Plan

| Path                                         | Why                                               |
| -------------------------------------------- | ------------------------------------------------- |
| `src/editor/TextEditOverlay.render.test.tsx` | font gate before measure; typing render isolation |
| `e2e/text-frames.spec.ts`                    | caption renders the same in the spread thumbnail  |
| `docs/roadmap/P5/text-blocks-close.md`       | item scope (stub filled)                          |
| `docs/roadmap/P2/text-blocks.md`             | `Status: done` via `pnpm roadmap done`            |

- Reuse: `makeBook` / `makeSpread` / `makeFrame` fixtures, `textEditStore` API, e2e `addText` / `openSessionEditor`.
- Tests: unit (2 cases) + e2e (1 case); no PBT (no new pure logic).
