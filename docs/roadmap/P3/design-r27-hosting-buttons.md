# design-r27-hosting-buttons

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item design-r27-hosting-buttons
Status: done

## Scope

Designer parity connect-own-hosting 2026-11-14 (Musts M114, M115, M117): Settings → Hosting setup card position, step buttons and two icon sizes differ from the kit (`#/feature/site-settings` hosting scenarios, 1440×900). Lane: `src/editor/HostingSetup.tsx`, `src/editor/HostingSection.tsx`, `src/editor/hostingBits.tsx`, `src/editor/SettingsScreen.tsx`, their tests, `e2e/design-r27-hosting.spec.ts`.

- [x] M114: the setup card top sits at y 121.44 ±0.5 (rel. `main`) in steps 1, 2 and 3; the manual form and the connected card stay at the same y
- [x] M115: step Change buttons 60.55×28 ±0.5, padding 0 8, 12px/500, ink rgb(57,55,56) ±2; CORS Copy 56.97×28 ±0.5 — without editing `src/ui/Button.css`
- [x] M117: the Checking… spinner box is 14×14; the Settings nav head icon is 12×12 (size prop, not a class)
- [x] Row 6 warn icon takes the warning colour
- **Done when:** the cases above pass in `e2e/design-r27-hosting.spec.ts` (Cloudflare/R2 stubbed like `e2e/hosting-setup.spec.ts`, paint checks); `e2e/hosting-setup.spec.ts`, `e2e/design-r26-icon-classes.spec.ts` and unit tests stay green; every Button with size/colour classes in `src/editor/Hosting*.tsx` / `hostingBits.tsx` and every `<Icon` with a size class there and in `SettingsScreen.tsx` is listed in the PR as already correct, fixed or left out.
- **Browser check:** Settings → Hosting at 1440×900: the setup card sits 20 px under the intro; Continue → step 2: the Change button is small (28 px, 12 px text); Checking… shows a 14 px spinner; manual mode: CORS Copy is 28 px high.
- **Hard nos:** no edit to `src/ui/Button.css`, `src/ui/Badge.*`, `uikit/**`, `src/editor/export/**`, `src/editor/print/**`; no other items' roadmap lines.
