# Review checklist

Single review checklist for Photobooks agents and reviewers. Prefer row ids over restating prose.
Implementation reviewer: answer each row `pass` / `n.a.` / `fail` with `file:line`.
`pnpm quality:self-check` prints one line per id before push; any `fail` stops the push.

- `scope`: change stays in declared touch-set / capability (same-capability helper/test extracts OK)
- `size`: plan and initial push ≤ 1500 changed lines (exclude lockfile, openspec/changes, uikit, binaries)
- `gates`: gate values and CI configs only get stricter vs `origin/main` (reuse pr-policy)
- `exclusions`: no new unauthorized coverage/mutation exclusions of production code
- `disables`: Stryker disables within budget; no file-wide or illegal forms; local report scanned
- `tests-first`: failing tests or scenarios before production code where the change claims behavior
- `evidence`: ticked `tasks.md` boxes name a test (`file::title`), link, or commit SHA
- `roadmap-follow-ups`: deferred blocking findings scheduled with `pnpm roadmap add --after`
- `pr-body`: required `.github/PULL_REQUEST_TEMPLATE.md` headings present and non-empty; no `fix`/`revise` verdicts
- `english`: repository English (code, commits, OpenSpec); no non-English in committed product paths
- `real-input`: modules that parse external tool/file formats have a `test/fixtures/real/` capture referenced by tests
