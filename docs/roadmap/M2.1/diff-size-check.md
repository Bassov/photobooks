# diff-size-check

Tag: prep
Milestone: M2.1
Title: hard size limit, no exception label (issue #72 H)

## Scope

- [ ] `scripts/check-diff-size.mjs` (with tests) as a `pr-policy` step. It counts total changed lines (code + tests + config + docs) against the merge base with rename detection, excluding `pnpm-lock.yaml`, `openspec/changes/**`, binary files and image / photo assets by extension (including SVG; e.g. fixtures under `uikit/public/**`). It warns above 1000 and fails above 1500, with no label or override. The CI report shows the total and the production `src/**` share
- [ ] `openspec/config.yaml` `rules.proposal` and "Change size" in the roadmap rules (`docs/roadmap/RULES.md`): ~1000 target / 1500 hard limit, pointing to the growth rule
- **Done when:** a PR the size of PR #71 fails `pr-policy`, a ~1100-line PR passes with a warning, and nothing can make a 1600-line PR pass.
