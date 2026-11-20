## Proposal

Roadmap: `docs/roadmap/P5/frame-copy-paste-kit.md` (scope / Done when / Browser SoT). Designer spec `frame-copy-paste` (Must FC1).

### Scope out

- Alt-drag duplicate (FC2, `canvas.tsx`), core ops (FC3), prod (FC4 / FC5).
- D7 photo remap: kit photos are one global pool, so a pasted photo always stays; only a missing frame style is dropped.
- Reveal-scroll after paste: the stacked pasteboard already centres the current spread.

### Delta / Risk

- UI e2e lock-ins: empty (Ctrl+V with no frames payload / in the spread list pastes nothing), happy (+5/+5 mm, in place on another spread, step repeat), interact (undo one step each, Caption keeps native copy / paste).
- Chromium's Ctrl+Shift+V paste event carries plain text only; with no text on it the kit pastes its in-memory last copy.
