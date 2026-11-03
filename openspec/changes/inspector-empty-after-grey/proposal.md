## Proposal

Roadmap: [`docs/roadmap/P2/inspector-empty-after-grey.md`](../../../docs/roadmap/P2/inspector-empty-after-grey.md) (SoT). UI ref: `uikit#/demo` (`context-inspector.tsx` `ContextInspector`).

### Scope out

- Crop entry still drops the frame selection: the first Esc out of crop shows Spread (kit: Photo).
- No kit `node: none` empty state on a third Esc (brief: never empty while a book is open).
- Active spread still follows scroll; only the context kind is matched.

### Delta / Risk

- Root cause: local `dismissed` state in `Inspector` (see design). e2e locks the Spread paths; the no-spreads empty hint is unit-only (fixtures always have spreads).
