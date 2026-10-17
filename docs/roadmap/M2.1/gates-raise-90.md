# gates-raise-90

Tag: prep
Milestone: M2.1
Title: raise the gates to their targets (issue #72 A, B)

## Scope

- [ ] `codecov.yml` `patch.default.target: 90%`. Diff `break: 90` in `quality/gates.json`. `ci-gates` spec delta
- [ ] Only when the last five merged `stryker-diff` runs scored at least 90 and patch coverage was at least 90%. Otherwise add the missing tests as checkboxes right after this item and do them first
- **Done when:** a PR with 89% patch coverage or an 89 diff mutation score fails.
