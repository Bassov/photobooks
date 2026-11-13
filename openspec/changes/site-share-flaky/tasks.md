## Implementation

- [x] 1. `ShareButton.tsx`: press number state; the 2 s window starts at the first frame after the commit (rAF → timeout), cleaned up on re-press and unmount.
- [x] 2. `ShareButton.test.tsx`: late clipboard promise, second click during "Copied", unmount with a pending promise, window measured from the frame (`with the room CSS` describe + `arms no timer when the write settles after unmount`).

## Manual test scenarios

1. 1440×900 `site.html?book=alps`: click Share → "Copied" at the same width, "Share" after about 2 s.
2. Click Share, click again after 1 s → "Copied" stays until about 2 s after the second click.
