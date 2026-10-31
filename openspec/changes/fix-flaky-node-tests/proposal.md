## Proposal

Roadmap: `docs/roadmap/P1/fix-flaky-node-tests.md` (scope / Done when SoT).

### Scope out

- Running the rig `test:host` suite in any CI (neither repo runs it today); listed as a gap in the PR body.
- The other host-dependent tests in `e2e-burn-in-targets.test.mjs`.

### Delta / Risk

- Both tests moved to `@albasov/ts-agent-rig` in `bdb011e`, so the fix is a rig PR; photobooks only bumps the pin and drops the moved fixture.
