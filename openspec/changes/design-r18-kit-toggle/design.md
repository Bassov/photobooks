## Decisions

1. Resize the kit sandbox `Toggle` in place (`h-5 w-9`, knob `size-4`, `left` 2 / 18) rather than swap it for the RAC `Switch`: the Toggle keeps its `button[role=switch]`, `data-testid`, `.e7-tg` fills (#CACACA off, #A8A8A8 on) and `.e7-knob` paint, so the existing kit QA and e2e selectors stay valid.
2. `-my-px` on the track, same as prod `.insp-toggle` (`margin-block: -1px`): a 20 px track then lays out as the old 18 px one, so the 18.84 px text rows keep their height and nothing below them moves.
3. Explicit `.e7-tg:focus-visible` ring, 2 px solid #535152 offset 2 — the kit's control ring token used by `.e7-mkdef` / `.e7-sel` (prod `--muted-foreground`).

## Touch-set & Test Plan

| Path                          | Why                                       |
| ----------------------------- | ----------------------------------------- |
| `uikit/src/sandbox/v7.tsx`    | Toggle size, knob, row margin, focus ring |
| `e2e/kit-toggle-size.spec.ts` | new kit paint/geometry lock-in            |

- Reuse: `e2e/fixtures/switchGeometry.ts` `expectKitSwitchSm` (box + knob + paint probe), kit demo open flow from `e2e/kit-undo-fixes.spec.ts`.
- e2e (`#/demo`, 1440 × 900): Book settings Endpapers (on) and Skip first page (off → click → on) measure 36×20, knob 16 at +2/+18 with knob paint, right edge 1424; rows keep their heights; master Page numbers toggle the same; Tab focus shows a 2 px outline offset 2.
- Unit/PBT: N/A (no `src/` change).
