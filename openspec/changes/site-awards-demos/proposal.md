## Proposal

Roadmap: `docs/roadmap/P2/site-awards-demos.md` (scope / Done when / Browser). UI ref: Designer Spec `photobooks-orch/shared/design/site-awards/spec.md` (Items 1–2).

### Scope out

- Demos 2–5 (a later Designer spec), the `#/demo` site steps (Spec Item 3), prod.
- Edits to `site-viewer.tsx` / `library.tsx` (live neighbour lane): Fullscreen and the cover face are copied into `uikit/src/features/site-demo-1/`.

### Delta / Risk

- DEMO branch, never merged (draft PR). Kit only; no spec delta, no dependency change.
- UI observables (kit qa smoke `site-demo-1`): happy = shelf → book page → cover opens (`data-view` 1) → page turns (`data-view` 2, no leaf left) → Fullscreen reads "Pages 2–3"; scrolling only inside the site root (`ps-site`).
