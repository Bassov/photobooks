## Decisions

1. **Persist via `src/ui/preferredTheme.ts`** — extend it mirroring kit `uikit/src/kit/theme.ts`: read `localStorage` key `photobooks-theme`, else `prefers-color-scheme`; `setTheme` writes `document.documentElement.dataset.theme` + storage; `useProductTheme` via `useSyncExternalStore` only in the toggle control.
2. **Toggle UX** — Moon/Sun `IconButton` in `EditorTopBar` (`data-testid="app-theme-toggle"`); labels “Dark theme” / “Light theme”. Add `moon`/`sun` glyphs to `src/ui/icons/glyphs.ts`. No React theme context wrapping pasteboard/spreads.
3. **Tokens / paper** — keep existing B / B-dark in `tokens.css`; `--paper` stays light; spread CSS already uses `var(--paper)`. Tick `docs/design.md` dark-theme migration row.
4. **Tests** — unit: storage + prefers fallback + setTheme attribute write. E2e: toggle flips chrome/`data-theme`, paper/spread stay light, reload keeps choice; axe empty+happy under `b` and `b-dark`; LoAF gate: toggle while mid-scroll on `?fixture=painter` pasteboard (`?perf=1`). “Baselines” = token/color asserts (screenshot backlog remains deferred).
5. **Mutation** — prefer extract (pure helpers + toggle component) over bang excludes; if touching excluded files, reinclude + ≥85 / 0 NoCoverage.
6. **Specs** — `skip_specs: true` (no `src/` domain contract change).

## Touch-set & Test Plan

- Files: `src/ui/preferredTheme.ts` (+test) / product theme API; `glyphs.ts` moon/sun; `EditorTopBar.tsx` (+test/css); `mountPhotobooks` boot; `docs/design.md`; `e2e/design-tokens.spec.ts`, `e2e/a11y-contrast.spec.ts`, theme/LoAF e2e; roadmap item ticks.
- Reuse: `IconButton`, `Icon`, kit theme pattern, existing `--paper` / axe fixtures, `__photobooksPerf` LoAF.
- Tests: unit theme read/write/persist; TopBar toggle; e2e empty/happy interact (toggle), paper both themes, axe both themes, mid-scroll toggle zero LoAF. `ui-review` + manual-qa before archive.
