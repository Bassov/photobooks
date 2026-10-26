## Implementation

- [x] 1. Extend `getBrowserSupport` with UI `variant` + browser label (iframe/insecure/missing-picker stay gate inputs; brands for copy/label only) — `browserSupport.ts` + unit tests
- [x] 2. Port `FeaturedIcon` + needed Icon glyphs; replace `UnsupportedBrowserScreen` with kit layout/CTAs driven by support snapshot — `src/ui/FeaturedIcon.tsx`, glyphs, screen
- [x] 3. Update editor-shell unsupported requirement (kit copy/CTAs/variants; no continue-anyway); retire EmptyState placeholder for this surface; unit + e2e lock-ins — specs delta, `UnsupportedBrowserScreen.test.tsx`, `e2e/library-screens.spec.ts`

## Manual test scenarios

1. Force unsupported (remove `showDirectoryPicker` / open in Firefox) — kit title/body, Get Chrome, Chromium list or no-api tips, Copy link; no Welcome behind it
2. Supported Chromium desktop — Welcome (or library) boots; unsupported not shown
3. Copy link — clipboard feedback (“Link copied”); Get Chrome opens chrome download in a new tab

OK: 1 — Playwright e2e `unsupported browser blocks…` (Firefox brands): unsupported-browser, Get Chrome, browser-list, Copy link → Link copied, no welcome/library/editor; named `unsupported-scroll` under forced overflow
OK: 2 — existing welcome/library e2e still green on supported Chromium (FSA stub)
OK: 3 — same unsupported e2e: Copy link → Link copied; Get Chrome `rel=noopener noreferrer` + chrome href; no-api e2e shows Reload

## UI review

- Design system: Theme B tokens / FeaturedIcon soft-warning / kit CTAs; no parallel colour system — OK
- A11y: page `h1`, focus-visible rings on links/buttons, labeled Copy link — OK
- Layout smoke (Playwright): empty unsupported readable; happy CTAs; scrollport vertical overflow contained — OK
- Anti-slop: grayscale chrome, Lora `.heading`, no purple/glow — OK
