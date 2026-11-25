# unit-test-timeouts

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item unit-test-timeouts

## Scope

Pre-push unit verify failed under load on the same tests, blocking pushes for hours on 2026-11-25: the `libraryDocument` property 'any v0 / v1 document upgrades to an empty v4 library' timed out at 5000 ms, `HostingSection` did not find `hosting-connected`, and EditorShell, startPrint and lint-autofix tests failed once at loadavg 25+ (all pass alone). Flaky is a bug: no raised timeouts, no fewer fast-check runs, no skips or retries.

- [ ] Each named test fits its budget deterministically with the same properties and assertions: slow product code is fixed in the product (library parse builds no schema for an empty list), and a wait on async UI waits on the work itself, not on a wall-clock `findBy` budget.
- [ ] `VITEST_MAX_WORKERS=8` full `pnpm test`, two runs at once, 5 rounds in a row: none of these failures.
- [ ] PR body: the property's run time before/after, and each test touched with why it was flaky.
- **Browser check:** none (unit tests and a pure parse helper; no UI change).
