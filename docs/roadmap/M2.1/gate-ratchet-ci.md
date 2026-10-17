# gate-ratchet-ci

Tag: prep
Milestone: M2.1
Title: checks can't be removed or softened in workflows and tooling

## Scope

- [ ] Extend the ratchet. `.github/workflows/**` jobs and steps (by name) are not removed, and no `continue-on-error`, `|| true`, new `if:` skip conditions, `paths` / `paths-ignore` filters or narrowed `on:` triggers are added to gate workflows. `package.json` `verify:fast` / `verify` / `audit:ci` keep their parts and levels. `.dependency-cruiser.cjs` rules are not removed or downgraded. `tsconfig*.json` strict flags and the ESLint presets / `--max-warnings=0` are not relaxed. `knip.json` ignores do not grow. `lefthook.yml` pre-push keeps `verify:fast`
- [ ] Gate scripts (`scripts/*` used by CI): their test cases may only grow (the case-id superset rule, as for the ratchet)
- **Done when:** fixture PRs that remove the `Mutation scope` step, add `continue-on-error` to `stryker-diff`, add `paths-ignore: ['docs/**']` to `integration`, drop `pnpm deps` from `verify:fast` or delete a dependency-cruiser rule each fail `pr-policy`.
- **Size:** ~500 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 K
