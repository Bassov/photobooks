## Decisions

1. CSS `zoom: var(--ui-scale)` on the overlay roots `.pb-dialog-overlay` (`Dialog.css`; `AlertDialog` and every caller go through `Dialog`) and `.pb-toast-region` (`Toast.css`). React Aria portals them to `<body>`, outside `#root`; `--ui-scale` is on `<html>`. No TSX change and no caller edits: no caller sets its own overlay root. No new tokens: `--ui-scale` already exists.
2. A fixed `inset: 0` overlay under zoom s lays out as W/s × H/s app px, so centring and the `--app-vw` / `--app-vh` caps give the 100 % layout × s.
3. At 100 % `zoom: 1` is a no-op (IS10).
4. At DPR 1 Chrome paints a zoomed border as whole device px (toast 1 px border: 1, not 1.5, at 150 %), so the e2e takes that snap off R(s) around the box's anchor; every other value is exact.

## Touch-set & Test Plan

| File                                                                  | Why                             |
| --------------------------------------------------------------------- | ------------------------------- |
| `src/ui/Dialog.css`                                                   | overlay root zoom               |
| `src/ui/Toast.css`                                                    | toast region zoom               |
| `e2e/interface-size-modals.spec.ts`                                   | new: IS5 dialogs + toast = R(s) |
| `openspec/changes/interface-size-modals/specs/interface-size/spec.md` | ADDED requirement               |

- e2e (`channel: 'chromium'`): s = 1.25 / 1.5 at 3840×2160 vs 100 % at 3840/s × 2160/s; rect × s ±0.5 px for Create book, Print, AlertDialog (library Remove…) and the specimen error toast; inside the viewport; `elementsFromPoint` at the dialog centre hits the dialog.
- Unit: none (CSS only).
