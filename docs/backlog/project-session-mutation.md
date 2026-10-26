# project-session-mutation

Tag: prep
Milestone: M2.1
Title: mutate what is left of `projectSession.ts` (issue #72 B)

## Scope

- [ ] Remove the last `temporary` entry. Kill survivors in the remaining orchestrator
- [ ] `quality/exclusions.yaml` has no `temporary` entries left. The `temporary` category is removed from the registry schema (the ratchet keeps it out). Update SoT (`quality/gates.json` / ratchet) — no `ci-gates` pointer-spec delta
- **Done when:** a change to any production file under `src/` is mutated by `stryker-diff`, and the nightly run covers the same set.
- **Reason:** owner 2026-10-27: product first (finish the editor on the kit v0.9.3 chrome, then the personal site); quality-gate and audit work waits until the owner re-adds it.
