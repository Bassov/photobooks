## Proposal

Roadmap: `docs/roadmap/P2/parent-overrides-core.md` (SoT).

### Scope out

- Canvas, badge, menus, inspector (`parent-overrides-canvas`, `-inspector`); copy-guide drag / drag-off and Delete on a copy (PO3 / PO5).
- Snapping to hidden parent guides: N/A until parent guides feed snapping.

### Delta / Risk

- `updateFrame` and core frame ops also reach `parentOverrides.frames`; copy edits never detach the template.
- Keep-work also runs on `removeParent` / `setDefaultParent` (Designer decision: "changing a spread's master keeps override copies").
