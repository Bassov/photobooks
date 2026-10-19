# Lesson 04

Do not weaken `tsconfig` / ESLint, add blanket `eslint-disable` / `@ts-ignore` / `as any`, skip/`fixme`/`test.fail`/retries, loosen assertions or tolerances, delete tests or helpers, add or widen coverage or mutation exclusions, lower thresholds, or remove checks for any reason — fix with code, tests, or a test seam. The only allowed `Stryker disable` is the budgeted next-line form `// Stryker disable next-line <Mutator>[,…]: <reason>` (reason ≥ 10 chars) within `mutation.disableBudget` and the per-file cap; a `tasks.md` note does not justify a survivor.
