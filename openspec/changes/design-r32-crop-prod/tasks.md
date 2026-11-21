## Implementation

- [x] 1. M123: lift the frame with `CROP_Z_BOOST` while the hover photo layer shows (unit + e2e hits / ghost pixel). `SpreadView.chrome.test.tsx` "a shown layer lifts…", `direct-crop-pinned.spec.ts` "(M123)" (fails without the lift: hit = `spread-frame-placeholder`).
- [x] 2. M124: pinned Esc exits crop and keeps the frame selected; second Esc deselects (unit + e2e). `cropGesture.test.ts` "exits on Escape…", `direct-crop-pinned.spec.ts` "(M124, M126)", `crop-in-frame.spec.ts` Esc test.
- [x] 3. M125: corner scale bounded by the zoom limits; inward drag at cover keeps the photo (unit + e2e). `cropMath.test.ts` "(M125)" + 8× tests, `direct-crop-pinned.spec.ts` "(M125)".
- [x] 4. M126: Tab focuses photo handles without scrolling the canvas (unit + e2e). `cropGesture.test.ts` Tab preventScroll, `direct-crop-pinned.spec.ts` "(M124, M126)".

## Manual test scenarios

1. Spread with two side-by-side photo frames: hover the left frame's grabber → ghost and all 4 photo handles over the right frame.
2. Double-click a photo frame → pinned; Esc → frame handles + Photo inspector; Esc → Spread inspector.
3. Fill frame at cover: drag the se photo handle inward → the photo does not move.
4. Zoom in so the frame sits right of the left panel, pin, Tab → canvas does not scroll.

manual-qa (2026-11-21): problem (harness) 1–4: `start-session` click intercepted by the welcome header on every retry; no scenario step ran. Covered by e2e instead: 1 → `direct-crop-pinned.spec.ts` "(M123)"; 2 → "(M124, M126)" + `crop-in-frame.spec.ts` Esc; 3 → "(M125)"; 4 → "(M124, M126)" (all green locally).

ui-review: pass. No new tokens / primitives; focus ring unchanged (2 px `#3A3839`, asserted); keyboard path Tab / Esc; reduced motion untouched; happy (ghost paint), interact (Tab keeps scroll), empty (second Esc clears) in e2e + `assertDocumentFitsViewport`.
