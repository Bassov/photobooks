# no-untested-branches

Tag: prep
Milestone: M2.1
Title: unreachable code is deleted, not defended (dead/defensive code finding)

## Scope

- [ ] Rule in the `openspec/config.yaml` quality bar, the `write-tests` skill and implementation-reviewer check 5: a guard or branch that no test can reach is removed; a surviving mutant in a redundant guard is fixed by deleting the guard, not by a `tasks.md` "equivalent" note
- [ ] `scripts/check-new-branches.mjs` in `pr-policy` (reads the v8 `coverage-final.json` artifact from `checks`): an uncovered branch on an added line fails in `src/core`, `src/lib`, `src/render`, `scripts/` and React-free `src/editor/*.ts` modules; elsewhere changed-file branch coverage must be at least 90%
- [ ] The report lists each uncovered branch as `file:line`
- **Done when:** a fixture that adds an unreachable `if (x == null) return` to a pure module fails `pr-policy`, the same branch with a test that reaches it passes, and the CI report names the line.
- **Size:** ~400 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #82 N1/N2/N8/N9, PR #81
