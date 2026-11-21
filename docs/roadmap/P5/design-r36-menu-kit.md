# design-r36-menu-kit

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r36-menu-kit
Status: done

Designer Round 36 parity for the frame context menu in the kit (Musts M141–M143; Spec
`shared/design/frame-context-menu/spec.md`). Kit-only: prod already matches the Spec (`design-r36-menu-prod` owns src/).

## Scope

- [x] M141 `uikit/src/components/ui/menu.tsx`: menu separator `bg-muted` → `bg-border` (#CDCDCD, as prod and the Spec).
      Every kit menu built on `menu.tsx` gets the new separator colour (listed in the PR body).
- [x] M142 `uikit/src/components/ui/menu.tsx`: destructive row hover `bg-destructive/[.08]` → `bg-destructive/10`
      (≈ rgb(208.2), the Spec's 10 % mix).
- [x] M143 `uikit/src/sandbox/canvas.tsx`: photo pick "Replacing" tag `rounded-sm` → `rounded-md` (8 px, as the kit crop
      tag and prod).
- [x] e2e `e2e/kit-*.spec.ts`: separator paint rgb(205,205,205), Delete hover paint within ±1 of rgb(208.2), pick tag
      border-radius 8 px.
- **Browser check:** kit `#/demo` at 1440 × 900: frame context menu separators #CDCDCD, hovered Delete row ≈ rgb(208),
  Replace photo… → "Replacing" tag with 8 px corners.

## Done when

- Kit menu separator colour rgb(205,205,205); Delete row hover bg within ±1 of rgb(208.2); pick tag border-radius 8 px
  (paint / computed-style checks in a `e2e/kit-*.spec.ts`, never in `uikit/scripts/qa.mjs`).
- Other kit menus using `menu.tsx` checked for the separator change (listed in the PR body).
