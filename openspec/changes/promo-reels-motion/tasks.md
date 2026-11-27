## Implementation

- [x] 1. `beats.js` + `Springs.js`: reel grids, cue helpers, springs, easing, cursor glide, camera path.
- [x] 2. Layers: Camera, Cursor, Grain, Focus, Background, PdfSheet, Phone, EndCard (+ text probe).
- [x] 3. `ReelStub.jsx` + `stub.shots.js`; Root registers ReelA|B|C + ReelSheetA|B|C.
- [x] 4. `reels-audio.mjs`: music + SFX per reel on its grid, WAV writer, onset check (a/b/c: max offset 0 frames).
- [x] 5. `reels-render.mjs`: prepare → audio → render → poster → sheet → checks 1–8, exit 1 on failure.
- [x] 6. `--selftest` bad fixtures (each check 1–8 fails) + smoke render of stub reel A (checks 1–8 green).

## Manual test scenarios

N/A (promo tooling, no UI in the product). Evidence: smoke render + selftest output in the PR body.
