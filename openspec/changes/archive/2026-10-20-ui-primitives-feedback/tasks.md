## Implementation

- [x] 1. Feedback primitives Status/Toast/Badge/ProgressBar/EmptyState + helpers
- [x] 2. Overlay primitives Dialog/AlertDialog/Popover/Menu + Button `destructive`
- [x] 3. Specimen feedback + overlays sections; unit + e2e
- [x] 4. Verify + ui-review; archive / done / finish

## Manual test scenarios

1. OK `/?specimen` feedback + overlays interact (Status, Toast, EmptyState, Dialog Esc, Menu delete)
2. OK `/` empty home — no page scroll
3. OK `/?fixture=painter` — pasteboard scrollport

### ui-review

- Design system / a11y / layout smoke / anti-slop: Pass (tokens; live regions; labelled close; e2e scrollports).
