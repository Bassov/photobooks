# cycle-layouts-core

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item cycle-layouts-core
Status: done

Core part of the Designer feature "cycle layouts" (tool 5, decision D6, item CL1; Owner Q-27 2026-11-20). A layout change (picker click, regrid) must move frames and never edit photos; today `rebindFrames` keeps only id, rect, z, assetId and crop.

## Scope

- [x] `src/core/templates/apply.ts` `rebindFrames`: a rebound frame keeps id, assetId, crop, fit, adjust, caption, frameStyleId and locked; rect and z come from the template and rotation resets. Frames with no previous counterpart stay as generated.
- [x] `src/core/templates/apply.rebind.test.ts`: unit cases per kept field and for the rect / z / rotation reset, plus a PBT over A → B → A.
- **Browser check:** none (core only; kit CL2 and prod CL3 are later items).

## Done when

- [x] Applying a layout keeps fit, adjust, caption, frameStyleId and locked (unit + PBT green); rect / z / rotationDeg equal the template.
- [x] Existing template / apply tests green.
- [x] PR body lists every caller of the apply path as covered.
- [x] stryker-diff on apply.ts not below the repo threshold; `pnpm roadmap check` green.
