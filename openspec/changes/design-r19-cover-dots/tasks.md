## Implementation

- [x] 1. e2e `e2e/cover-stage-dots.spec.ts`: paint probe on spread workspace, cover, endpaper and masters (red first: cover band read a flat 198–199 against the workspace 230 dots)
- [x] 2. Shared `.editor-workspace, .cover-stage` background rule; drop the flat `.cover-stage` background; unit CSS assertion updated (`src/editor/EditorShell.test.tsx`; e2e green)

## Manual test scenarios

1. Open a session book at 1440×900, select the cover: dots around the sheet, no jump against the spread view.
2. Select the front endpaper, then Masters: dots around the sheet on both.

- problem (harness): 1–2 — `pnpm agent manual-qa` timed out clicking `start-session` (welcome header intercepts pointer events); no product behavior observed. Evidence instead: `e2e/cover-stage-dots.spec.ts` paints the spread, cover, endpaper and masters at 1440×900 (green locally).
