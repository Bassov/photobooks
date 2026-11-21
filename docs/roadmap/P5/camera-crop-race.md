# camera-crop-race

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item camera-crop-race
Status: done

## Scope

Bug (found by #675): in the trace of `e2e/direct-crop-pinned.spec.ts` "pinned crop … wheel zoom" the canvas jumps (~+53/+158 px) in the frame where pinned crop turns on right after a wheel zoom, and a photo handle lands under the inspector. Seen on #664 shard 3/16, #680 and main c6f95ff before #675 made the test wait for a still camera. Cause: the wheel/pinch settle in `src/editor/usePasteboardCamera.ts` commits the gesture frame's scroll, computed from the scroll at gesture start; a native scroll of the pasteboard inside the 80 ms settle window (the click's scroll-into-view, scrollbar, focus) is undone at commit, so the canvas snaps back.

- [x] Settle commits what is on screen: port scroll − live world translate, for wheel and pinch
- [x] e2e in `direct-crop-pinned.spec.ts`: wheel zoom + native scroll + double-click into pinned crop with no stillness wait; per-frame frame rect stays within 1 px (red on main, 10/10 after)
- [x] Unit test (`cameraGesture.test.tsx`): a native scroll during a live wheel / pinch zoom shifts the committed scroll by the same px
- [x] PR body lists every crop-entry caller and camera-settle path as fixed or left out with a reason
- **Browser check:** wheel zoom over a frame, double-click it at once: the canvas does not move when pinned crop turns on; all 4 photo handles stay in the canvas
- **Done when:** the new race test fails on main edeeb62 and passes 10/10 (`--repeat-each=10 --workers=1`); `direct-crop-pinned`, `crop-in-frame`, `arrange-lock` pass 10/10; camera offset in the crop-on frame changes ≤1 px (number in the PR body)
- **Hard nos:** no edits under `uikit/**`, `src/ui/Icon*`, `Filmstrip*`, `editorChromeTokens.ts`, `styles/tokens.css`, inspector files; #675's existing test unchanged; no loosened test or gate
