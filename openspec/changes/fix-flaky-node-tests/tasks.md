## Implementation

- [x] 1. Rig: inventory test reads a package-owned `testdata/test-weakening-inventory/` via `import.meta.url` (ts-agent-rig `ec325b2`; 0/200 after, sequential + load)
- [x] 2. Rig: spawned burn-in CLI test resolves the CLI via `import.meta.url` and writes an inline `quality/gates.json` (ts-agent-rig `ec325b2`; 0/200 after, sequential + load)
- [x] 3. Rig PR incl. version bump 0.2.20 (ts-agent-rig#10 merged at `ec325b2`, tag `v0.2.20`)
- [x] 4. Photobooks: pin the new rig tag; remove `testdata/test-weakening-inventory/` and its eslint ignore (lands on this branch once the tag exists)
- [x] 5. Evidence in the PR body: before/after 200-run loops (sequential, parallel load)

## Manual test scenarios

N/A (test harness only, no UI).
