# deps-prod-twmerge-leading

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item deps-prod-twmerge-leading

## Scope

Land Dependabot #722 (production group: tailwind-merge 3.7.0 → 3.7.1, lucide-react 1.73.0 → 1.77.0) with the kit
pixels unchanged. tailwind-merge 3.7.1 no longer drops an earlier `leading-*` when a later `text-<size>` (no `/N`)
is merged, so kit `Label` / `SliderOutput` / `Switch` call sites that override the font size kept the base
`leading-none`, and `uui/Badge`'s base `leading-none` (always dropped by its own size class before) now applied.

- [ ] Lockfile and manifests equal the Dependabot branch for tailwind-merge and lucide-react; no spec numbers change.
- [ ] Every call site that overrides the font size of a component with a base `leading-*` sets the line height
      explicitly (`leading-(--text-xs--line-height)` / `leading-(--text-sm--line-height)`, the font-size default);
      `uui/Badge` drops the dead `leading-none`.
- [ ] No spec pins lucide `clock` / `spray-can` geometry (the icons that changed in 1.77).
- [ ] `e2e/kit-frame-style.spec.ts`, `e2e/kit-live-captions.spec.ts`, `e2e/kit-interface-size.spec.ts` pass with
      unchanged numbers; `pnpm uikit:build` + `pnpm uikit:qa:quick` green.
- **Browser check:** kit `#/demo` inspector: Straighten row 48 px below the rotate row; live-caption chips aligned.
