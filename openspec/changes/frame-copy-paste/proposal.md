## Proposal

Roadmap: `docs/roadmap/P5/frame-copy-paste.md` (SoT). Designer Spec frame-copy-paste FC4; UI ref: kit `#/demo` (`viewport.tsx` `useFrameClipboard`).

### Scope out

- Alt+drag duplicate (FC5); cover, endpapers and Masters: keys do nothing (D10).

### Delta / Risk

- Empty / happy / scroll observables as in the roadmap Browser check; scrolling only inside `pasteboard-scroll`, no page-level H/V scroll.
- Security: a pasted payload is Zod-parsed; an invalid one pastes nothing.
