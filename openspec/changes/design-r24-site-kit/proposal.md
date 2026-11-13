## Proposal

Roadmap: `docs/roadmap/P5/design-r24-site-kit.md` (scope / Done when / Browser). UI ref: `uikit#/demo`.

### Scope out

- Prod `src/**` (already opens on the Cover; design-r24-site-prod lane).
- The home tap (opens at the cover and turns it, D23): unchanged.
- No spec delta: kit-only parity, no `src/` capability behavior changes.

### Delta / Risk

- UI e2e lock-ins: happy = direct `?book=` load and `#/demo` Preview rest on "Cover" (label painted on top, still "Cover" after the 360 ms cover-turn window); interact = → turns to "Page 1", a kit state naming a slide opens that slide; empty = N/A (a room needs a book).
- Kit specs that measured the room at view 1 after a direct load now turn there with Next first.
