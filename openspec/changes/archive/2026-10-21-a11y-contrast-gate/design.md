## Decisions

1. **No new dependency:** load `axe-core` by resolving through `@lhci/cli` (already present for LHCI); inject via `page.addScriptTag`. Do not add `@axe-core/playwright`.
2. **AA only:** axe `runOnly` tags `cat.name-role-value` + `wcag2aa`; explicitly disable `color-contrast-enhanced` (AAA).
3. **Token fix, not shells:** raise light `--muted-foreground` to `#6a6761` so muted-on-muted AA holds; keep bang-excluded `EditorShell` / `HomeScreen` / `App` untouched.
4. **Surfaces:** `?specimen`, editor empty (`openSessionEditor`), happy (`?fixture=painter`). Empty `AXE_ALLOWLIST` (may only shrink later).

## Touch-set & Test Plan

| File                                                 | Why                              |
| ---------------------------------------------------- | -------------------------------- |
| `e2e/fixtures/axe.ts`                                | shared axe inject + assert       |
| `e2e/a11y-contrast.spec.ts`                          | specimen / empty / happy + probe |
| `src/ui/tokens.css`                                  | muted-foreground AA              |
| `uikit/src/index.css`                                | kit token parity                 |
| `docs/roadmap/M2.5/a11y-contrast-gate.md`            | scope tick                       |
| `openspec/changes/a11y-contrast-gate/proposal.md`    | plan                             |
| `openspec/changes/a11y-contrast-gate/design.md`      | decisions + touch-set            |
| `openspec/changes/a11y-contrast-gate/tasks.md`       | tasks + manual                   |
| `openspec/changes/a11y-contrast-gate/.skip-specs`    | no domain specs                  |
| `openspec/changes/a11y-contrast-gate/.openspec.yaml` | change meta                      |

Unit: N/A (e2e owns axe). E2e: three surfaces + low-contrast probe. Manual: specimen / empty / happy readability.
