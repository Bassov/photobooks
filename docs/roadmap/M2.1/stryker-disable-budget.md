# stryker-disable-budget

Tag: prep
Milestone: M2.1
Title: only next-line Stryker disables, capped and budgeted (PR #81 pattern)
Status: done

## Scope

- [x] The only legal inline form is `// Stryker disable next-line <Mutator>[,<Mutator>]: <reason>` (reason ≥ 10 chars). File-wide `// Stryker disable <...>`, `disable all`, block `disable` / `restore` pairs fail `pr-policy`
- [x] At most 3 per file; a repo-wide budget `mutation.disableBudget` in `quality/gates.json` starts at the current count (0 on `main`) and can only shrink (ratchet)
- [x] `stryker-pr-summary.mjs` lists every disable in the changed files with its reason; `Ignored` mutants count against the file in the CI report
- [x] `openspec/config.yaml` `operations.apply` and implementation-reviewer check 5: a reason in `tasks.md` no longer justifies a survivor; delete the dead code or use the budgeted next-line form
- **Done when:** a PR with #81's file-wide disable fails, a fourth next-line disable in one file fails, one over the repo budget fails, and a single reasoned next-line disable within budget passes with its reason shown in the CI report.
- **Size:** ~300 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #81, #72 B

## Done note

Budgeted next-line Stryker disables only; mutation.disableBudget=0; summary lists disables + Ignored per file.
