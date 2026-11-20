## Decisions

1. Radii: the existing `--radius-*` scale already holds the Spec roles (2 / 4 / 6 / 8 / 10 / 14). The one pill token `--radius-full: 9999px` goes into both `@theme` blocks, so Tailwind `rounded-full` emits `var(--radius-full)`, and the token `:root` blocks (prod 999 → 9999; kit gains it). `var()` passes css-tokens.
2. Shadows: `--shadow-book*`, `--page-shadow` rgb(0 0 0) → rgb(20 20 19), same alphas; `--shadow-xs…lg` already match.
3. `--warning-ink: #845510`; `--ink-warning` aliases it; kit `--color-warning-ink`. PRINT warnings and Print Check rows (prod + kit) use it.
4. Top-bar pills: `var(--radius-full)`, no `calc(infinity …)`.

## Touch-set & Test Plan

| File                                      | Why           |
| ----------------------------------------- | ------------- |
| `styles/tokens.css`                       | tokens        |
| `uikit/src/index.css`                     | kit tokens    |
| `src/editor/BookSettingsSection.tsx`      | PRINT ink     |
| `src/editor/print/PrintDialog.css`        | Check row ink |
| `src/editor/EditorTopBar.css`             | pill          |
| `uikit/src/demo-parts/dialogs.tsx`        | kit Check ink |
| `src/editor/BookSettingsPrinter.test.tsx` | pin           |
| `e2e/polish-surface.spec.ts`              | new probes    |
| `e2e/design-r11-topbar.spec.ts`           | pin           |
| `e2e/library-screens.spec.ts`             | pin           |
| `e2e/printer-presets.spec.ts`             | pin           |
| `e2e/design-r31-cover-check.spec.ts`      | Check ink     |
| `e2e/design-r11-canvas.spec.ts`           | pin           |
| `e2e/design-r3-spread-shadow.spec.ts`     | pin           |
| `docs/design.md`                          | tokens        |

e2e: empty (welcome pill), happy (top-bar pill, dialog / control radius, prod + kit token probes), interact (open Print → warning row ink). Low-res chip stays pinned by `design-r16-prod`. Skill `ui-review` before push.
