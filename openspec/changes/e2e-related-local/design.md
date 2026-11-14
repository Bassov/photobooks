## Decisions

1. Diff: `git diff -U3 <merge-base(base, HEAD)> -- src` over the working tree, base = `$STRYKER_DIFF_BASE ?? origin/main`; untracked `src/` files count as added. Only `.ts`, `.tsx`, `.css`.
2. Ids come from hunk lines only (`+`, `-`, context): `data-testid` / `testId` / `testid` / `dataTestId` with `=` or `:` and a quoted value; a template literal yields its text before `${` as a prefix.
3. Consumers per e2e file: `getByTestId('x')`, ``getByTestId(`x-${…}`)`` (prefix), `[data-testid="x"]`, `[data-testid^="x"]` (prefix). A prefix on either side matches by `startsWith`. Helper string args are not matched.
4. Support-file hits propagate to every spec whose relative-import closure reaches them.
5. Rank by matched-id count desc, then path; cap `E2E_RELATED_MAX` (default 12). Skip flaky specs (rig `loadFlakySpecPaths`) and specs changed in the diff (the rig runs those).
6. Run through the rig's `with-playwright-env.mjs`: chromium, workers=1, dot, `--pass-with-no-tests`. Git and spawn args never come from diff content.

## Touch-set & Test Plan

| Path                                   | Why                                              |
| -------------------------------------- | ------------------------------------------------ |
| `scripts/e2e-related.mjs`              | selection + runner (reuses rig loader + wrapper) |
| `scripts/e2e-related.test.mjs`         | unit tests                                       |
| `package.json`                         | `test:e2e:changed:quiet` chains the related step |
| `docs/agent-loop.md`                   | B row + stage 4 wording                          |
| `docs/roadmap/P3/e2e-related-local.md` | item scope                                       |

- Tests (vitest): hunk-only extraction, template prefix both sides, fixture propagation, cap ordering + dropped list, flaky / changed skip, `main` with fake git/spawn.
