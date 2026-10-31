## Decisions

1. Flake 1 root cause: the former full-repo walk TS-parsed every test file twice and hit the 5 s Vitest timeout under CI load (7 CI failures, all `Test timed out in 5000ms`). `4686c57` already swapped in a 7-file mini tree. Remaining defect: the rig test finds that tree via `resolveRepoRoot()` (cwd / `TS_RIG_REPO_ROOT`). Move the tree into the rig at `testdata/test-weakening-inventory/` (outside both Vitest includes and the published `files`, so the package does not ship it; the test runs only under `test:host`) and resolve it with `import.meta.url`.
2. Flake 2 root cause: the first version spawned the CLI in the live repo with base `origin/main`, so the diff was empty whenever HEAD == origin/main (CI run 39084956813, `expected [] to include 'e2e/burn-in-smoke.spec.ts'`). `368352d` moved it into a tmp repo. Remaining defect: the rig test joins `process.cwd()` with a stale `packages/ts-agent-rig/src/…` path and copies the host `quality/gates.json`, so it fails on every run. Resolve the CLI with `import.meta.url` and write a minimal valid gates object into the tmp repo.
3. No timeout, retry or assertion changes.

## Touch-set & Test Plan

- Rig: `src/check-test-weakening.test.mjs`, `src/e2e-burn-in-targets.test.mjs`, `testdata/test-weakening-inventory/**` (moved), `package.json` version.
- Photobooks: `package.json` + `pnpm-lock.yaml` (rig pin), `testdata/test-weakening-inventory/**` (removed), `eslint.config.js` (drop the ignore for the removed tree; lint config edit, reason: path no longer exists).
- Tests: the two tests themselves; proof = `.cache/flaky/loop.sh` / `load.sh` 200-run loops, before and after, from the rig root and the photobooks cwd.
