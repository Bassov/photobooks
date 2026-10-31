# fix-flaky-node-tests

Tag: feature
Milestone: P1
Title: Bug: fix-flaky-node-tests: make 2 flaky node tests deterministic (root cause, no loosening)

## Scope

- [ ] `check-test-weakening` inventory (ts-agent-rig): read a package-owned fixture resolved from the test file, not the host `testdata/` via cwd / `TS_RIG_REPO_ROOT`
- [ ] `e2e-burn-in-targets` spawned CLI (ts-agent-rig): CLI path from `import.meta.url` (no stale `packages/ts-agent-rig/` path) and an inline `quality/gates.json` in the tmp repo (no host copy)
- [ ] Photobooks pins the rig tag with both fixes; drop the moved `testdata/test-weakening-inventory/` and its eslint ignore
- **Done when:** root cause per flake named with CI evidence; before/after 200-run loops (sequential and under parallel load) show 0/200 after for both tests from any cwd; no retries, raised timeouts, skips or weakened asserts; photobooks pins the tagged rig
- **Browser check:** N/A (test harness only)
