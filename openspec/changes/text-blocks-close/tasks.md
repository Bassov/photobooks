## Implementation

- [x] 1. Unit: the first overflow measure waits for the text style fonts, loaded once for every spread (`src/editor/TextEditOverlay.render.test.tsx` "measures overflow only after the text style fonts loaded").
- [x] 2. Unit: typing in a text frame commits no render on either spread; the commit re-renders only the edited spread (same file, "typing renders no spread").
- [x] 3. e2e: a caption renders the same in the workspace and the spread thumbnail (`e2e/text-frames.spec.ts` "a caption renders the same").
- [x] 4. PR body maps each `text-blocks` Scope line to its covering test; `pnpm roadmap done text-blocks` and `text-blocks-close`.

## Manual test scenarios

N/A — tests and docs only, no UI change (the e2e in task 3 walks the browser check).
