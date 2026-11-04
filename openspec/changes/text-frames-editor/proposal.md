## Proposal

Roadmap: `docs/roadmap/P2/text-frames-editor.md` (scope / Done when / Browser / Perf / Test SoT). UI ref: Designer `text-frames` spec (Items 3), kit `uikit/src/sandbox/canvas.tsx` + `sections.tsx` `TextSection`.

### Scope out

- Live captions block (`live-captions`) and PDF text (`pdf-captions`).
- Kit, core ops and the text painter (merged: `text-frames-kit`, `text-frames-core`).

### Delta / Risk

- History gains an editor-side coalesce key per edit session; an empty new frame takes its create step back.
