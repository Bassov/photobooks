## Proposal

Roadmap: `docs/roadmap/P5/frame-copy-paste-core.md` (scope / Done when). Designer spec `frame-copy-paste` (D3–D8, Payload, Core); kit maths reference `uikit/src/sandbox/clipboard.ts`.

### Scope out

- Editor keys, DOM clipboard events, mirror, step memory, status pill and undo labels (FC4, `src/editor/**`).
- Alt-drag duplicate (FC5).

### Delta / Risk

- New ops run through `normaliseAnchors` like every op; D6 is applied inside the op so no caption reaches it dangling.
