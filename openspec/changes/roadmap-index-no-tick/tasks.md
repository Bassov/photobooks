## Implementation

- [x] 1. `scripts/roadmap-done.test.mjs`: fixture CLI test — `done` changes only the item file, `next` skips the done item with an untouched index line, `check` exits 0 with a `sync:` warning. (3 tests pass)
- [x] 2. `openspec/config.yaml` `operations.archive`: drop the `pnpm roadmap sync` step.
- [x] 3. `docs/roadmap/RULES.md`: lines 30-31 → the item PR writes `Status: done` in its item file only; delete the adjacent-tick conflict sentence (net shorter: 11256 → 11029 bytes).
- [x] 4. Skill `roadmap` + `docs/agent-loop.md` lines 88, 133, 157: no per-PR `sync`, no tick-conflict merge recipe.
- [x] 5. One-time migration: `pnpm roadmap sync` ticked 8 lines (incl. `locked-frame-swap`).

## Manual test scenarios

N/A — process / docs change, no UI. Evidence: the CLI test and `pnpm roadmap check` output.
