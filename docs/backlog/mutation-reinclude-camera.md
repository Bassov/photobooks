# mutation-reinclude-camera

Tag: prep
Milestone: M2.1
Title: mutate `usePasteboardCamera.ts` again (issue #72 B)

## Scope

- [ ] Remove its `temporary` entry. Kill survivors with `renderHook` and wheel / pointer events (the `cameraGesture.test.tsx` pattern)
- [ ] If the tests to reach 85 go over budget, use the growth rule: first a `[prep]` that moves the pure zoom / pan math into `camera.ts` with property tests, then the re-include
- **Done when:** `usePasteboardCamera.ts` is mutated on both runs, scores at least 85 with no NoCoverage, and the `camera-zoom-pan` perf gate still passes.
- **Reason:** owner 2026-10-27: product first (finish the editor on the kit v0.9.3 chrome, then the personal site); quality-gate and audit work waits until the owner re-adds it.
