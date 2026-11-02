## Proposal

Roadmap: `docs/roadmap/P2/parent-spreads-schema.md` (scope / Done when SoT). Reference model: `uikit/src/sandbox/model.ts:43-70,181`.

### Scope out

- Any UI, painter or editor wiring (`src/editor/**`, `src/render/**`); no e2e.
- Parse-time referential invariants for `parentId` / `defaultParentId` (resolver treats a dangling id as "None").

### Delta / Risk

- Schema v10: every new field is optional, so v9 → v10 only bumps `schemaVersion` and keeps all data (incl. `masterId`).
- Local override copies keep showing when their parent item is gone (no data loss).
