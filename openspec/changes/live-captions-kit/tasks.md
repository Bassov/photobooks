## Implementation

- [x] 1. `meta.ts`: `tokenValue`, `fillTokens` value rules, `defaultAnchor`.
- [x] 2. `store.tsx` `removeFrames` helper; inspector Delete button and Del key use it.
- [x] 3. `sections.tsx` Live block (switch / disabled hint / anchor select / chips / caret insert / Make static).
- [x] 4. `canvas.tsx` text edit keeps Live.
- [x] 5. Demo walk step `editor-text-live` after `editor-text-overflow`.
- [x] 6. e2e `e2e/kit-live-captions.spec.ts` (happy / interact / empty, layout y ±1 px).

## Manual test scenarios

1. `#/demo` editor: draw a text frame on a spread with a photo, type, click chips date + camera → canvas shows the date and camera, chips on one row.
2. Switch Live off → canvas text unchanged, textarea shows it without `{`; Ctrl+Z → template back.
3. Live on, select the anchor photo frame, Del → caption text unchanged, switch off.
