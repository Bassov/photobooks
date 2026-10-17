# deps-rules

Tag: prep
Milestone: M2.1
Title: stricter dependency-cruiser rules (#50 item 7)

## Scope

- [ ] `.dependency-cruiser.cjs`: `no-circular`, `photo-no-editor`, `lib-no-app-layers`, `no-testing-in-prod` (with an allowlist for the painter fixture), each with a `comment`
- **Done when:** `pnpm deps` fails on a new import cycle, and existing cycles are fixed here or added as checkboxes right after this item.
