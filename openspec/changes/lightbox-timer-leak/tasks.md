## Implementation

- [x] 1. Unit test: unmount `LightboxPager` mid-settle leaves no pending timer (`src/render/LightboxPager.test.tsx` "drops the pending zoom settle on unmount"; fails on main: 1 timer).
- [x] 2. Clear the settle timeout on unmount in `src/render/useLightboxZoom.ts`.
- [x] 3. Audit every timer / rAF / listener / observer in `src/render/` (list in design.md Decision 2 and the PR body).

## Manual test scenarios

N/A — no user-visible change; covered by the unit test and 5× `pnpm vitest run src/render`.
