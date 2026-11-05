## Decisions

1. Percent layout of the printed sheet in a pure `coverLayout(geometry)` (from `bookCoverGeometry`); the display-only spine / wrap constants go.
2. `CoverView` takes `cover` + `geometry` and is memoised; `CoverCanvas` / `CoverSection` read a stable geometry selector (previous object while equal), so a frame edit never re-renders the cover and a Pages change re-renders only cover views.
3. Drops are handled on the sheet and accepted only over the front board and its wrap band (orch note: back board / spine refuse).
4. One spine-text rule (centred, scales with the spine) on the canvas and every mini cover; no fixed 3 px.
5. Paint reuses the kit cover values already in `CoverView.css` (`--cover-*`, `--canvas` veil mix, `--foreground` chip and drop outline, `--text-2xs`); no new tokens. `ui-review` before push; e2e cover empty / happy / drop.

## Touch-set & Test Plan

| Path                                                  | Why                               |
| ----------------------------------------------------- | --------------------------------- |
| `src/render/coverLayout.ts`                           | percent layout, geometry equality |
| `src/render/CoverView.tsx`                            | layer stack, chip, memo           |
| `src/render/CoverView.css`                            | sheet layers, spine text          |
| `src/editor/CoverCanvas.tsx`                          | selectors, sheet drop             |
| `src/editor/CoverSection.tsx`                         | sub + spine hint                  |
| `src/editor/PresentationMode.tsx`                     | new CoverView props               |
| `docs/design.md`                                      | cover line                        |
| `src/editor/coverSelectors.ts`                        | stable cover / geometry snapshots |
| `src/site/__snapshots__/renderSitePage.test.tsx.snap` | site cover markup snapshot        |
| `src/site/export/buildSiteTree.test.ts`               | inline site snapshot (+88 B)      |
| `e2e/cover-editor.spec.ts`                            | sheet, drop, perf gate            |

- Unit: `coverLayout`, `CoverView`, `CoverParity`, `CoverCanvas`. e2e: Designer "Tests → Update" list plus new `e2e/cover-editor.spec.ts` with a frame-budget perf describe (Pages change: zero LoAF, no DOM mutation in spread views).
