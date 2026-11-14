## Implementation

- [x] 1. e2e: hovered CORS Copy paints rgb(57,55,56) ±2 on the unchanged ghost hover fill (`e2e/design-r27-hosting.spec.ts` M114 / M115 / M120 case; red before the fix: computed ink rgb(83, 81, 82))
- [x] 2. Copy gets `data-[hovered]:text-foreground!`; `XS_GHOST` comment names the hover ink (`src/editor/HostingSection.tsx`, `src/editor/hostingBits.tsx`)

## Manual test scenarios

1. Settings → Hosting → manual setup at 1440×900: hover CORS Copy; the grey label turns dark on the grey hover fill, back to grey on leave.
   - problem (harness): `pnpm agent manual-qa` timed out on `start-session` at the welcome screen (click intercepted by the welcome `header`); scenario not reached. Covered by e2e `design-r27-hosting.spec.ts` M114 / M115 / M120 (rest grey, hover dark ink on rgb(207,207,207), painted pixels), green locally.
