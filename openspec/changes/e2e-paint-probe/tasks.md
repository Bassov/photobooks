## Implementation

- [x] 1. `e2e/fixtures/paintProbe.ts`: `topAt` + `pixelsAt` (per call, 1 worker: `pixelsAt` 117–222 ms, `topAt` 22–31 ms)
- [x] 2. Migrate the probes in `kit10-cover`, `design-frame-crop-masters`, `presentation-mode` to `topAt` (net −15 lines: −10 / −3 / −2)
- [x] 3. `layout-grids-parent-inherit`: grid paint on both pages of a two-page spread; fails with the overlay z-fix reverted (`page 3`: on = off `[196, 165, 116, 255]`), passes with it
- [x] 4. `kit10-spread-list`: no paint inside `.editor-spread-thumb` outside the paper (0; an injected box background reads > 0.9)
- [x] 5. `docs/agent-loop.md` testing line (stage 3)

## Manual test scenarios

N/A (e2e fixture and docs only, no UI change).
