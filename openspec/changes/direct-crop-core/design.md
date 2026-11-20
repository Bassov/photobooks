## Decisions

1. Model (as `imageMatrix`): in the shown (quarter-turned) image the photo is `frame / window` mm, offset `u` from the frame centre in photo axes, rotated by `rotationDeg + straightenDeg` about the frame centre. Keep-photo: same size, `u' = u + R(-(θ+φ))(C − C')`; crop = inverse of `shownCropRect` (zoom = `base · Iw / box.w`, centre = window centre).
2. Fill cover: the photo must contain the padded box (`shownCropRect`'s straighten box). Else scale by the minimal `k ≥ 1` about the frame edge / corner opposite the moved one (edges compared in the new frame's axes, 1e-6 mm; centre when both or neither moved). `clampCrop` then normalises (zoom ≤ 8, Fit letterbox, float residue).
3. Fit: only `clampCrop`. No photo: as `resizeFrame`, with its guards (locked, non-finite, edge < 5 mm, unchanged).

## Touch-set & Test Plan

| Path                                  | Why                     |
| ------------------------------------- | ----------------------- |
| `src/core/ops/transform.ts`           | `resizeFrameKeepPhoto`  |
| `src/core/ops/applyBookOp.ts`         | op union + switch       |
| `src/core/index.ts`                   | export                  |
| `src/core/ops/transform.test.ts`      | unit + PBT              |
| `src/core/parentOverrides.test.ts`    | op list on a local copy |
| `docs/roadmap/P5/direct-crop-core.md` | stub scope filled       |

- Tests: unit (edges, corners, Fill anchors, Fit, rotated, straightened, locked, empty frame); PBT: page rect invariant ≤ 1e-6 when the old photo covers the new frame and zoom ≤ 8; Fill always covered.
