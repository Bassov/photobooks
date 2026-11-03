## Proposal

Roadmap: [`docs/roadmap/P2/parent-spreads-inspector-guides.md`](../../../docs/roadmap/P2/parent-spreads-inspector-guides.md); UI ref: kit `uikit#/feature/parent-spreads` (`viewport.tsx:224`), Designer MS10.

### Scope out

- Inherited guides on spreads and snapping (`parent-guides`).
- Kit: already matches MS10; demo steps 74–75 unchanged, so no baselines.

### Delta / Risk

- Observables: empty (Master A, 0 guides), happy (top-ruler drag → one master `guide-line` in `parent.guides`, kept after save + reload), interact (move = one undo step; drop on ruler removes). No page-level scroll.
- `?fixture=painter` is in-memory: reload runs on `?testLibrary=1` + New master.
