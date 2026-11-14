## Decisions

1. Ghost ink = kit (no own colour, inherits): drop `color` from `.pb-button--ghost`; the `styles/app.css` base layer gives buttons `color: inherit`, so `text-*` utilities now win. Hover stays `--foreground` on `--accent`.
2. Kit-muted ghosts keep their ink with the kit's class `text-muted-foreground`: zoom menu (`EditorTopBar.tsx`), Reset to cover (`FitCropSection.tsx`), Reset adjustments (`FrameLookSections.tsx`), Remove from frame (`PhotoSection.tsx`). Change library folder already has it; icon buttons, AlertDialog, export dialog, frame delete and settings back keep their scoped CSS.
3. Primary hover uses the existing `--primary-hover` token (#3a3839).
4. Small dot badge `padding-left: var(--spacing)` (kit `pl-1`); md/lg dot and plain badges unchanged.

Existing tokens only; `docs/design.md` needs no change. Skill `ui-review` before push.

## Touch-set & Test Plan

| Path                                   | Why                           |
| -------------------------------------- | ----------------------------- |
| `src/ui/Button.css`                    | ghost ink, primary hover      |
| `src/ui/Badge.css`                     | sm dot padding                |
| `src/ui/Badge.test.tsx`                | dot flag on the sm badge      |
| `src/editor/EditorTopBar.tsx`          | zoom menu keeps muted         |
| `src/editor/FitCropSection.tsx`        | Reset to cover keeps muted    |
| `src/editor/FrameLookSections.tsx`     | Reset adjustments keeps muted |
| `src/editor/PhotoSection.tsx`          | Remove from frame keeps muted |
| `e2e/design-r27-button-styles.spec.ts` | paint checks                  |

e2e (paint): happy — Hosting Check again, Cancel setup, Forget ink ±2; Connected dot badge vs Default badge boxes; interact — hover on two primaries (Hosting, Create book) ±2; kept-muted zoom menu. Empty: N/A (no list). Unit: Badge dot flag.
