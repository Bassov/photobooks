## Proposal

Roadmap: `docs/roadmap/P5/design-r32-crop-prod.md` (scope / Done when / Browser SoT). UI ref: kit `uikit/src/sandbox/canvas.tsx` FrameChrome.

### Scope out

- Kit Musts M127 / M128 (kit item; no `uikit/` edits).
- Spec delta: none, the `pasteboard` / `editor-shell` contracts already hold.

### Delta / Risk

- No page-level H/V scroll; Tab must not scroll the `pasteboard-scroll` scrollport.
