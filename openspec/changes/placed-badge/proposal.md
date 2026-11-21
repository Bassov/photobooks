## Proposal

Roadmap: `docs/roadmap/P5/placed-badge.md` (scope / Done when / Browser). UI ref: `uikit#/demo` filmstrip; Designer spec PB3.

### Scope out

- `placementsOfAsset` (core) and the kit, both merged, are unchanged.
- `editorChromeTokens.ts` stays byte-identical (editorHardNos pins it).

### Delta / Risk

- Badge = `span role=button`, not `<button>`: the native drag of `.filmstrip-drag` and the row tab stop stay.
- No page scroll; only `pasteboard-scroll` moves, and only when the frame is out of view.
