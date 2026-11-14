## Implementation

- [x] 1. `rowBands` + banded `grain` + shared `nextTask` in `gl/canvas.ts` (`canvas.test.ts`).
- [x] 2. Face source paints in clipped bands, grains in bands, never in the caller's task (`faces.test.ts`).
- [x] 3. Open book endpaper grains in bands (`open.test.ts` stays green).

## Manual test scenarios

N/A — no visible change (same faces, same grain); covered by `e2e/gl-faces-probe.spec.ts` and unit tests.
