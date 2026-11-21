## Proposal

Roadmap: `docs/roadmap/P5/direct-crop-pinned.md`. UI ref: kit `#/demo` `editor-crop-mode`.

### Scope out

- `uikit/` and core ops (existing `setCrop` / `setFit` / `rotateFrame` only).
- Copies' selection peers keep today's chrome.

### Delta / Risk

- Prod has no rotate knob; the chip needs one, so a direct photo frame gets the kit knob (changes `e2e/design-r2-inspector.spec.ts:145`).
