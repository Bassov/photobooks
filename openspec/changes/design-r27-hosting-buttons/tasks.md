## Implementation

- [x] 1. M114: the `@container` wrapper takes the card's `mt-5`, the card `mt-0` (`HostingSetup.tsx`; e2e `design-r27-hosting.spec.ts` steps 1–3, connected, manual).
- [x] 2. M115: Change and CORS Copy buttons with important size / type / ink utilities (`XS_GHOST` in `hostingBits.tsx`; e2e Change ×2, Copy).
- [x] 3. M117: 14 px `Spinner` in `CheckingLabel` (`hostingBits.test.tsx`, e2e spinner); nav head `bookOpen` `size={12}` (e2e); row 6 warn colour on a wrapper.
- [x] 4. Cloudflare relay stub as a shared e2e fixture (`e2e/fixtures/cloudflareRelay.ts`); `e2e/design-r27-hosting.spec.ts` locks the Done-when numbers and paint.

## Manual test scenarios

1. Settings → Hosting at 1440×900: the setup card sits 20 px under the intro in steps 1–3; Change buttons are 28 px, 12 px text; Checking… spinner 14 px.
2. Manual mode: the CORS Copy button is 28 px high; the setup → connected card keeps its position.
