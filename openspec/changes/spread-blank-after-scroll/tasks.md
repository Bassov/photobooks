## Implementation

- [x] 1. Allow progressive lower-tier publishes in `tierDisplay` while a higher desired tier is pending.
- [x] 2. On `ConnectedSpreadView` mount, queue cached ladder steps ≤ desired so a lower hot URL can show before covering decode.
- [x] 3. Spec delta: progressive fallback MUST NOT leave a filled frame blank when thumb/lower tier is available.
- [x] 4. Unit/ConnectedSpreadView regression: progressive swap + remount with lower cache only shows non-blank filled preview; empty frame stays placeholder.

## Manual test scenarios

1. Open a multi-spread book with placed photos; scroll the pasteboard quickly end-to-end and back — filled frames must show thumb/lower preview immediately (not blank), then sharpen to covering tier.
2. Empty frames stay placeholders; no page-level scroll (pasteboard scrollport only).
