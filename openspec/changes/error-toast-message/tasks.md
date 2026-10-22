## Implementation

- [x] 1. Fix `importErrorsToastContent` so the description pairs each file with its own message (empty message → name only).
- [x] 2. Add a unit regression: multi-error toast description must not reuse the first message for every file.

## Manual test scenarios

1. Import a HEIC and a broken JPEG together → toast lists each name with its own reason (HEIC conversion vs decode); open Show files → panel groups by reason correctly.
