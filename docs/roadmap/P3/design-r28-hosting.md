# design-r28-hosting

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item design-r28-hosting
Status: done

## Scope

Designer parity connect-own-hosting p2 2026-11-15 (Musts M114 carry-over, M120): two Settings → Hosting differences from the kit (`#/feature/site-settings` hosting scenarios, 1440×900). Lane: `src/editor/HostingSection.tsx`, `src/editor/hostingBits.tsx`, `src/editor/HostingSetup.tsx`, their tests, `e2e/design-r27-hosting.spec.ts`.

- [ ] M114 (manual): the manual pane inherits the kit's 19.5 px line height, so the "Set up automatically instead" link's line box matches, the help h2 top is y 550.91 ±0.3 and the help block 582.33 ±0.3 at 1440×900; the setup card stays at 121.44
- [ ] M120: CORS Copy paints the muted ink rgb(83,81,82) ±2 and stays 56.97×28 ±0.5, padding 0 8, 12px/500; step Change buttons keep rgb(57,55,56)
- **Done when:** the cases above pass in `e2e/design-r27-hosting.spec.ts` (Cloudflare/R2 stubbed like `e2e/hosting-setup.spec.ts`, y rel. Settings `main`, paint checks); `e2e/hosting-setup.spec.ts`, `e2e/design-r26-icon-classes.spec.ts` and unit tests stay green; every user of `XS_GHOST` is listed in the PR with its kit ink (Change = foreground, Copy = muted) as fixed or already correct.
- **Browser check:** Settings → Hosting at 1440×900, manual mode: the help heading sits under the "Set up automatically instead" link as in the kit; the CORS Copy label is grey, lighter than the Change labels of the guided setup.
- **Hard nos:** no edit to `uikit/**`, `e2e/kit-*.spec.ts`, `src/ui/Button.css`, `src/editor/print/**`, `src/editor/EditorTopBar.tsx`; no other items' roadmap lines.
