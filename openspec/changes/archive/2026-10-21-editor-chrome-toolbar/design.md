## Decisions

1. **Extract `EditorTopBar`:** out of `EditorShell`; drop Stryker bang. Pure helpers (`runChromeImport`, `saveIndicatorLabel`, disable predicates, save shortcut) keep mutation ≥85. Tokens per `docs/design.md`.
2. **Primitives:** toolbar + `pb-button` chrome (one `default` primary: Add photos, or Grant access when permission-required). `CameraBar` titles/aria shortcuts. `SpreadTemplateBar` = SegmentedControl + native Add spread. Accessible names for e2e.
3. **Perf:** CameraBar zoom on `subscribeLive` only; top bar never live-zoom. Native `pb-button` + titles (RAC tipped LoAF); SegmentedControl native radios. CSS `:focus-visible` / `:hover` / `:disabled` mirror design-system states.
4. **Layout:** bars `flex-wrap` + `min-width: 0` in `editor-shell` (`overflow: hidden`); drop bespoke action/control skins.
5. **Shortcuts:** Save Ctrl/Cmd+S; Fit spread Ctrl+0 in title/aria. No invented undo/snap/grid tools.
6. **Security:** UI extract only; no change to FSA / permission grant / import pipeline.

## Touch-set & Test Plan

| File                                         | Why                              |
| -------------------------------------------- | -------------------------------- |
| `src/editor/EditorTopBar.tsx` + helpers      | extracted top chrome             |
| `src/editor/EditorShell.tsx`                 | thin compose (bang removed)      |
| `src/editor/CameraBar.tsx`                   | toolbar + shortcuts              |
| `src/editor/SpreadTemplateBar.tsx`           | SegmentedControl                 |
| `src/editor/EditorShell.css`                 | bar layout; focus/hover/disabled |
| `stryker.config.mjs` / `stryker.mutate.md`   | drop EditorShell bang            |
| unit/e2e chrome + camera/template            | names; LoAF; 320/4K wrap         |
| `docs/roadmap/M2.5/editor-chrome-toolbar.md` | scope ticks                      |

Reuse: `src/ui/{Toolbar,Button,IconButton,SegmentedControl,Tooltip,Icon}`. Unit: bars + zoom sub. E2e: names; zoom + template zero LoAF; 320/4K no page scroll. Manual + ui-review.
