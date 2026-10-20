## Proposal

Roadmap: [`docs/roadmap/M2.1/reimport-loaf-store-thumb.md`](../../../docs/roadmap/M2.1/reimport-loaf-store-thumb.md) (scope / Done when SoT). Prep fast-track; `skip_specs: true` (LoAF store/cache path; photo-card / session contracts unchanged).

### Scope out

- Budget / gate edits; new e2e beyond existing re-import LoAF lock-in
- Tier-cache put dedupe (thumbs only)
- Import pipeline / identity reuse changes

### Delta / Risk

- Identical re-import meta/patch must stay silent (no store emit); thumb DerivedCache puts skip when `contentHash` already written this session.
