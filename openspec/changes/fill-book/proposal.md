## Proposal

Roadmap: `docs/roadmap/P5/fill-book.md`. UI ref: kit `#/demo` Fill book chip (#700).

### Scope out

- Core `planFillBook` / `fillBook` rules (FB2) — called, not changed.
- `uikit/`, `placedJump.ts`, `pasteboardReveal.ts`, `relink/*` — import only.

### Delta / Risk

- e2e locks empty (chip disabled), happy (Enter fills, one Ctrl+Z) and interact (Esc, Masters) observables.
- Head chips keep their x; no new scrollport, the popover overlays the canvas, no page-level scroll.
