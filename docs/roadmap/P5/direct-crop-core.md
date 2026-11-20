# direct-crop-core

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item direct-crop-core
Status: done

## Scope

- [ ] Core of Designer feature "direct crop" (item 2 of 3: kit `direct-crop-kit`, core, prod `direct-crop`; Owner Q-18 2026-11-20 18:52). Designer Spec `walkthrough-ux-review` §A "Core": frame handles crop with the photo fixed on the page.
- [ ] `src/core/ops/transform.ts`: `resizeFrameKeepPhoto(book, spreadId, frameId, rect, aspectRatio?)` recomputes the crop so the photo's page rect is unchanged; Fill clamps to cover by scaling up about the frame edge / corner opposite the moved one (minimum change); Fit has no cover clamp. `resizeFrame` stays as is (layouts, multi-select).
- [ ] `src/core/ops/applyBookOp.ts`: op `{ type: 'resizeFrameKeepPhoto', spreadId, frameId, rect, aspectRatio? }`, one op = one history step; exported from `src/core/index.ts`; joins the op list of `src/core/parentOverrides.test.ts`.
- **Done when:** `resizeFrameKeepPhoto` + op exist and are exported; `resizeFrame` tests (`transform.test.ts:170`) unchanged and green; unit cases (each edge and corner shrink / grow, Fill clamp anchors, Fit, rotated frame, locked frame unchanged) and a PBT (photo page rect invariant ≤ 1e-6 when the clamp is inactive; frame always covered in Fill) green; stryker-diff on `transform.ts` not below the repo threshold.
- **Browser check:** none (no UI; the prod item `direct-crop` runs it).
- **Hard nos:** no `uikit/**`, `src/editor/**`, `src/render/**`, `e2e/**`.
- **Test:** unit + PBT in `src/core/ops/transform.test.ts`.
