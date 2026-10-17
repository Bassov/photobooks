# deps-rules

Tag: prep
Milestone: M2.1
Title: stricter dependency-cruiser rules (#50 item 7)

## Scope

- [ ] `.dependency-cruiser.cjs`: `no-circular`, `photo-no-editor`, `lib-no-app-layers`, `no-testing-in-prod` (no allowlist: the painter fixture is out of production since `test-hooks-out-of-prod`; only the guarded dynamic import is allowed), each with a `comment`
- **Done when:** `pnpm deps` fails on a new import cycle and on a static production import of `**/testing/**`, and existing cycles are fixed here or added as checkboxes right after this item.
- **Size:** ~300 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #50 item 7
