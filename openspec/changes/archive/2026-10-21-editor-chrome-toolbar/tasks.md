## Implementation

- [x] 1. Extract `EditorTopBar` (toolbar + Button styles, one primary: Add photos); remove EditorShell Stryker bang; pure helpers for mutation bar
- [x] 2. Rebuild `CameraBar` with toolbar role + shortcut titles; keep live-zoom-only subscription + zoom-indicator
- [x] 3. Rebuild `SpreadTemplateBar` with SegmentedControl (native radios) + Add spread; same radiogroup/radio names
- [x] 4. Restyle bars in CSS (wrap, tokens, primitive focus); drop bespoke camera/template button skins where replaced
- [x] 5. Update unit + e2e selectors to accessible names (`/Fit spread/`, toolbar roles); SegmentedControl native for LoAF

## Manual test scenarios

1. OK Empty editor: top-bar actions (Home, Open, Add photos) work by mouse and keyboard; one primary (Add photos); focus via `:focus-visible` / `:focus-within` on bars.
2. OK Happy (`?fixture=painter`): template SegmentedControl switches layout; CameraBar fit/width/100% update zoom; titles/aria show shortcuts.
3. OK Viewport 320 px and 4K: bars wrap (`flex-wrap`); no page-level H/V scroll; scrolling only inside pasteboard and filmstrip (`editor chrome bars wrap` e2e + containment).

### ui-review

- Design system / a11y / layout smoke: pass — chrome uses `pb-button` / SegmentedControl / tokens; one primary Add photos; e2e a11y-contrast + spread-view containment green (`/tmp/e2e-final.txt`, 32 passed). Anti-slop N/A (editor chrome, not marketing).
