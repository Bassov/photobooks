## Implementation

- [x] 1. e2e `e2e/kit-toggle-size.spec.ts`: kit Book settings / master Page numbers Toggles measure 36×20, knob 16 at +2/+18 with paint, right edge 1424, row heights unchanged, focus ring 2 px offset 2 (fails on the 32×18 Toggle).
- [x] 2. `uikit/src/sandbox/v7.tsx` `Toggle`: `h-5 w-9 -my-px`, knob `size-4` at left 2 / 18, `.e7-tg:focus-visible` ring.

## Manual test scenarios

1. Kit `#/demo` → Book settings: Endpapers (on) and Skip first page (off) look like the Live `Switch`; click flips the knob; Tab shows the focus ring.
2. Kit master → Page numbers Show toggle: same size and knob travel.
3. `uikit:build` + `demo:baseline` into `.cache/agent/`: the Endpapers / master Page numbers steps show the 36×20 Toggle.

- OK 1–2: `e2e/kit-toggle-size.spec.ts` 3/3 on `#/demo` at 1440 × 900 (box, knob paint, right edge 1424, rows 18.84, focus ring); `pnpm agent manual-qa` drives prod only, kit-only change.
- OK 3: `uikit:qa:quick` 422 passed / 0 failed; `demo:baseline` 80 steps, no page errors (steps 25, 26, 35, 37 show the Toggle).
