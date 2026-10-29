# Stryker C-session brief (template)

Policy: `docs/agent-loop.md` `## Stryker C-session`. Fill the placeholders and pass the result as the session brief. Modeled on the RESUME brief: no RESET, same branch.

---

RESUME (not RESET). Stryker C-session for `<slug>`. Soft cap: this one agent only.

- Branch: `<branch>` (PR #<PR#>), worktree `<worktree>`, tip `<tip>`. Do not create a new branch, worktree or PR.
- Failing check: `stryker-diff`, CI run <CI run URL>.

## Survivors

Per file (file, score, survived / NoCoverage):

- `<file>` — `<score>`, `<survived>` survived / `<noCoverage>` NoCoverage

## Do

1. Start from `git log origin/main..HEAD` and the survivor list; do not redo earlier stages.
2. Add tests only (skill `write-tests`, public API), or remove genuinely dead code. No feature work.
3. Re-run `pnpm stryker:diff` (foreground, explicit Bash timeout) until every file is >= 85 and NoCoverage is 0. Run `pnpm check:fast` before push.
4. Push to `<branch>` and print the PR URL. Exit; the orchestrator owns CI wait and merge.

## Hard nos

- No change to stryker thresholds, mutators, `quality/gates.json`, stryker config or CI workflows; no new Stryker disables; no mutator excludes.
- Keep the `stryker: deferred to C-session` waiver line in the PR body as is; the orchestrator removes it after green.
- No RESET, no force-push, no push to main, no new GH issues, no `--no-verify`.
