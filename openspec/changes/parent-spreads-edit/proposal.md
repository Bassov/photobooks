## Proposal

Roadmap: `docs/roadmap/P2/parent-spreads-edit.md` (scope / Done when / Browser SoT). UI ref: `uikit#/feature/parent-spreads`.

### Scope out

- Master inspector (kit `InspectorPart`, demo step 22) → `parent-spreads-inspector` (Owner brief split rule).
- Perf gate; Alt+click overrides.

### Delta / Risk

- Parent ids must never collide with spread ids (one edit path).
- e2e: empty (New master), happy (logo moved once → every spread), interact (rename / delete → None). No page-level H/V scroll; the masters list scrolls inside its panel.
