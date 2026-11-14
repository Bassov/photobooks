## Decisions

1. New `hostingSetup.tsx` (the card); `Swap` / `Fail` / `checkingLabel` / `when` move to `hostingBits.tsx` so the two files don't import each other. Fields reuse `BOX` / `ring()` / `ERR` (`printProfiles.tsx`); the domain select reuses the `print-default` select (`CHEVRON` moves next to `BOX`). Colours: kit tokens (`bg-field` #D7D7D7, `text-foreground`, `text-muted-foreground`); the marker ink #232223 and `ERR` are Spec values.
2. The setup token input is uncontrolled; Continue reads it once into a ref. Re-opening step 1 or leaving setup mode clears it.
3. Scenario seeds: `HostingInit.setup` freezes a state (as `checking` does today); `HostingInit.mode = "manual"` opens the old form. Check again in the R2-off / no-zone boxes succeeds (assumption: the kit pretends the user fixed it).
4. Both modes stay mounted (inactive `hidden`), so each keeps its typed values; the help list ids become `hosting-help-step-N` to free `hosting-step-N` for the stepper. Forget picks the mode from `rec.origin`.
5. Narrow: `@container` on the settings `main` (container queries for the subdomain width and footer wrap).

## Touch-set & Test Plan

| File                                     | Why                                   |
| ---------------------------------------- | ------------------------------------- |
| `uikit/src/demo-parts/hostingSetup.tsx`  | setup card                            |
| `uikit/src/demo-parts/hostingBits.tsx`   | shared bits                           |
| `uikit/src/demo-parts/hosting.tsx`       | modes, intro, connected lines, Forget |
| `uikit/src/demo-parts/session.tsx`       | record fields                         |
| `uikit/src/demo-parts/printProfiles.tsx` | `CHEVRON`                             |
| `uikit/src/demo-parts/settings.tsx`      | `@container`, `CHEVRON` import        |
| `uikit/src/features/pages.tsx`           | scenarios, edge lines                 |
| `e2e/kit-hosting-settings.spec.ts`       | manual-first; setup tests             |
| `e2e/kit-in-app-publish.spec.ts`         | lands on `hosting-setup`              |

- Tests: kit e2e for K1–K3 (geometry, states, resume, modes, Forget), paint checks via `pixelsAt`, token not in DOM / URL.
