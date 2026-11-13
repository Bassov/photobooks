## Decisions

1. Root cause: the Publish `SiteJobPill` carries the sandbox class `e7-sec`; `uikit/src/sandbox/v7.tsx` injects `.e7-sec:hover { background: #CDCDCD !important }`, which beats the inline `quiet` #D7D7D7. Drop `e7-sec` from the Publish `className` (keep `px-3.5`). Its only other effect is that hover rule, so idle width, padding and focus are unchanged.
2. Other end-group pills (bug rule): Preview, Settings, Export site, Print use `quiet` with no hover override — already same-as-Preview; no edit.
3. Tokens: the existing kit `quiet` control fill (#D7D7D7, `docs/design.md` control surface); no new tokens.

## Touch-set & Test Plan

| Path                              | Why                                 |
| --------------------------------- | ----------------------------------- |
| `uikit/src/demo-parts/editor.tsx` | drop `e7-sec` from the Publish pill |
| `e2e/kit-in-app-publish.spec.ts`  | K2 hover paint test                 |

- Reuse: `pixelsAt` from `e2e/fixtures/paintProbe.ts`, the spec's `seed` / `pill` / `width` helpers.
- Tests: e2e K2 `#/demo: Publish hovers like Preview` — hover each pill, pixel (6, 16) of a clipped screenshot: Publish = Preview = 215; idle Publish width 73.58, height 32, padding `0px 14px`. No unit / PBT (kit markup only).
