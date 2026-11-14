## Decisions

1. M114: `leading-[19.5px]` on the manual-mode pane (`<div hidden={mode !== 'manual'}>`), not a wrapper around the link. The link is an inline-block `<button>`; its line box takes the inherited line height, `normal` in prod and 19.5 px in the kit, where the whole pane (form card included, per the Designer's `par.json`) computes 19.5 px. It also fixes the help block's 0.70 px short height. A link-only wrapper would re-indent the click handler and surface its equivalent `secretRef` null-guard mutant.
2. M120: `XS_GHOST` keeps size only (`h-7! px-2! text-xs! font-medium`); ink moves to each caller: step Change (`HostingSetup.tsx`) adds `text-foreground!`, CORS Copy (`HostingSection.tsx`) adds `text-muted-foreground!` (kit ghost default ink). No twMerge override of one important colour by another.
3. Tests: extend `e2e/design-r27-hosting.spec.ts` instead of a new spec (same stubbing, `openHosting` / `expectXsGhost` helpers, no copy). `expectXsGhost` takes the ink (computed + painted via `pixelsAt`); the manual test checks help h2 / block y rel. Settings `main` (the Designer's frame).

## Touch-set & Test Plan

| Path                             | Why                                 |
| -------------------------------- | ----------------------------------- |
| `src/editor/HostingSection.tsx`  | guided link line box; Copy ink      |
| `src/editor/HostingSetup.tsx`    | Change keeps foreground ink         |
| `src/editor/hostingBits.tsx`     | `XS_GHOST` without ink              |
| `e2e/design-r27-hosting.spec.ts` | M114 help y, M120 Copy / Change ink |

- Reuse: `routeCloudflare` (`e2e/fixtures/cloudflareRelay.ts`), `pixelsAt` (`e2e/fixtures/paintProbe.ts`), tokens `text-foreground` / `text-muted-foreground` (docs/design.md).
- Tests: e2e only (class strings, no logic); existing unit tests stay green.
