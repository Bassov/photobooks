## Proposal

Roadmap: [`docs/roadmap/M2.5/editor-chrome-toolbar.md`](../../docs/roadmap/M2.5/editor-chrome-toolbar.md) (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/feature/editor-chrome-toolbar`.

### Scope out

- Tool/history/view toggles and Export primary from the kit demo (later milestones)
- `editor-chrome-states` empty/loading/error patterns
- Growing bang-excluded `EditorShell.tsx` — extract top bar instead

### Delta / Risk

- E2e: empty chrome by accessible name; happy (`?fixture=painter`) template + camera; primary interact (template switch + zoom). No page-level H/V scroll; scrolling only inside pasteboard and filmstrip (320 px / 4K bars wrap).
- Security: UI extract only; no change to FSA / permission grant / import pipeline.
