# design-r29-hosting-copy

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item design-r29-hosting-copy

## Scope

Designer parity connect-own-hosting p3 2026-11-15 (Must M120 carry-over, hover state): the Settings → Hosting CORS Copy button keeps its muted ink on hover, while the kit (`#/feature/site-settings` hosting scenarios, 1440×900) turns it to the foreground. Lane: `src/editor/HostingSection.tsx`, `src/editor/hostingBits.tsx`, their tests, `e2e/design-r27-hosting.spec.ts`.

- [ ] M120 (hover): CORS Copy (`hosting-cors-copy`) paints rgb(57,55,56) ±2 on hover with the hover background unchanged; at rest it stays rgb(83,81,82) ±2, 56.97×28 ±0.5
- [ ] M114 stays: the manual help h2 top is y 550.91 ±0.3 rel. the Settings `main`
- **Done when:** the cases above pass in `e2e/design-r27-hosting.spec.ts` (Cloudflare/R2 stubbed like `e2e/hosting-setup.spec.ts`, paint checks); `e2e/hosting-setup.spec.ts`, `e2e/design-r26-icon-classes.spec.ts` and unit tests stay green; every ghost Button with `text-muted-foreground!` in `src/editor/Hosting*.tsx` / `src/editor/hostingBits.tsx` is listed in the PR as fixed or already correct (kit hover ink).
- **Browser check:** Settings → Hosting at 1440×900, manual mode: hovering CORS Copy darkens its grey label to the foreground on the same grey hover fill as the kit.
- **Hard nos:** no edit to `uikit/**`, `e2e/kit-*.spec.ts`, `src/ui/Button.css`, `src/editor/print/**`, `src/editor/EditorTopBar.tsx`; no other items' roadmap lines.
