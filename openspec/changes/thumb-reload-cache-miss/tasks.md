## Implementation

- [ ] 1. e2e repro `e2e/thumb-reload-cache-miss.spec.ts` (fails on main).
- [ ] 2. `src/editor/thumbMissDecode.ts` + `ensureThumb` cache-miss branch: resolve File (retained or registered `AssetSource`), decode thumb320 through the pool, publish + cache, restore aspect; unit tests for the miss branch.

## Manual test scenarios

1. Folder with 200+ JPEGs: look only at the first screen, save, reload, scroll to the end: every tile fills in, none stays gray.
