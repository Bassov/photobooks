## Decisions

1. Reuse: the kit `Dock` (`uikit/src/sandbox/chrome.tsx`) already has an Unplaced `Toggle` and a sort `MenuTrigger` on `view.unplacedOnly` / `view.sort`, and `Filmstrip` already filters / sorts on them; `#/demo` loses them because `PhotosDock` passes `right=`. Extract them as an exported `FilmChips`; `PhotosDock` renders Relink · `FilmChips` · Add folder; the default `Dock` slot uses `FilmChips` too.
2. Chip styles, testids, aria-label, menu placement and the "N of M" head label follow prod `.film-chip` (`src/editor/editorChromeTokens.ts`, `FilmstripDock.tsx`) and the roadmap values. Colours are the kit's Theme B chrome tokens from `docs/design.md` (`SUB` / `T` ink, `FIELD` #D7D7D7 quiet fill, as `v7.tsx` exports them); right-group gap 8 (prod `gap-2`; was 4).
3. `#/demo` starts on Added order (prod default) via `DEMO_VIEW.sort`; the store default stays.

## Touch-set & Test Plan

| File                              | Why                                       |
| --------------------------------- | ----------------------------------------- |
| `uikit/src/sandbox/chrome.tsx`    | `FilmChips`, prod chip styles, head label |
| `uikit/src/demo-parts/editor.tsx` | `PhotosDock` right slot, `DEMO_VIEW.sort` |
| `uikit/scripts/qa.mjs`            | appended KS13 assertions                  |

- `demo-capture.mjs` unchanged: every editor step already shows the dock header; those baselines (untracked) are regenerated.
- Reuse: kit `Toggle`, `Button`, `MenuTrigger` / `MenuPopover` / `Menu`.
- Tests (kit qa, `#/demo` 1440 × 900): ±1 per-number assertions; empty (0 photos), happy (Unplaced filter + "N of M", all-placed copy), interact (sort menu options, relabel). Skill `ui-review` on `uikit#/demo`.
