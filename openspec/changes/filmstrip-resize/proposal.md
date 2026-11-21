## Proposal

Roadmap: `docs/roadmap/P5/filmstrip-resize.md` (scope / Done when / Browser SoT; e2e observables there). UI ref: `uikit#/demo` editor photos dock.

### Scope out

- `FilmstripItem*`, `EditorShell.tsx`, `uikit/src/**`.
- Any size control besides the separator.

### Delta / Risk

- Spec: MODIFIED `filmstrip` "Adjustable filmstrip thumbnail size". No page-level H/V scroll; scrolling only inside the filmstrip scrollport.
- Perf: each 4 px drag step re-lays out the virtual window.
