## Proposal

Roadmap: `docs/roadmap/P3/static-export-kit.md` (scope / Done when / Browser SoT). UI ref: Designer spec `static-export/spec.md`; `uikit#/feature/static-export`.

### Scope out

- Prod `src/` (pill, store, worker): item `static-export`.
- Real folder writes: the kit simulates the run.

### Delta / Risk

- Observables: empty = Options without a folder, Export disabled; happy = Export → Hide → "Exported" → idle; interact = pill rect stable across states. No page-level H/V scroll.
- `uikit/src/kit/pages.json` gets the page (kit manifest rule).
