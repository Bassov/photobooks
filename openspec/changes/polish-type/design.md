## Decisions

1. Type tokens in the `@theme` block of `uikit/src/index.css` and `styles/tokens.css` (same names and values, scale from the roadmap item): `--text-caps` (11/14 600, `--tracking-caps` 0.12em), `--text-caps-display` (11/16 500, `--tracking-display` 0.20em), `--text-meta`, `--text-small`, `--text-body`, `--text-label`, `--text-dialog-title`, `--text-page-title`, `--text-hero`. Tailwind v4 generates the utilities; `docs/design.md` Type row names them.
2. Panel caps (kit `.eyebrow`, prod `.inspector-eyebrow`, specimen h2, `tracking-[.12em]` classes) read `--tracking-caps`; the `.inspector-sec-title` override goes. Display caps (welcome, library, Example caption) use `text-caps-display`: prod `text-xs` was 12/16, so no box moves. The book object subtitle keeps its size and reads `var(--tracking-display)`.
3. Lora at 400: `--heading-weight` 500 → 400 in both files; `.pb-empty-title` (500) and `.editor-chrome .brand` (700) read it. Line-heights stay (no sweep in this item).
4. Book content Lora 500 (`src/core`, kit `sandbox/canvas.tsx`) and site caps (`features/site/base.css`, `art.tsx`) are out of lane: listed in the PR body.

## Touch-set & Test Plan

| Path                                     |
| ---------------------------------------- |
| `uikit/src/index.css`                    |
| `styles/tokens.css`                      |
| `styles/app.css`                         |
| `src/editor/EditorShell.css`             |
| `src/ui/SpecimenPage.css`                |
| `src/ui/EmptyState.css`                  |
| `src/editor/LibraryEmpty.tsx`            |
| `src/editor/WelcomeScreen.tsx`           |
| `src/render/BookObject.tsx`              |
| `src/editor/HostingSection.tsx`          |
| `src/editor/PrintPresetsSection.tsx`     |
| `src/editor/PrintProfileDialog.tsx`      |
| `uikit/src/features/library.tsx`         |
| `uikit/src/features/parts.tsx`           |
| `uikit/src/demo-parts/hosting.tsx`       |
| `uikit/src/demo-parts/printProfiles.tsx` |
| `uikit/src/demo-parts/settings.tsx`      |
| `uikit/src/sandbox/v7.tsx`               |
| `docs/design.md`                         |

- Tests: unit `BookObject.test.tsx`. e2e empty: `design-r10-library` (empty library caps 2.2 px / 500, positions unchanged); happy: `design-r10-library` welcome + Settings h1 400, `kit-library` (kit caps, Settings h1); interact: `design-r9-letter-spacing`, `design-r2-layout-picker` (inspector titles 1.32 px). Skill `ui-review` before push.
