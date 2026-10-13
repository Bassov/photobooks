# Tasks

## 1. Repo hosting config

- [x] 1.1 Add root `wrangler.jsonc` for an assets-only Worker (`name`, `compatibility_date`, `assets.directory: ./dist`, SPA `not_found_handling`) and verify `pnpm build` still produces `dist/` that matches the configured directory
- [x] 1.2 Add `wrangler` as a devDependency (pnpm) and a `deploy` script (or documented `pnpm exec wrangler deploy`) that validates against the checked-in config without changing app source
- [x] 1.3 Document in README: Cloudflare Workers Static Assets overview, required build/output settings, GitHub connect + non-production branch previews, and that PR preview links come from Workers Builds comments — verify the documented commands match `package.json` / Wrangler config

## 2. Cloudflare + GitHub connect (account)

- [ ] 2.1 Using Cloudflare dashboard and/or MCP, ensure a Worker exists for this project and the GitHub repo is connected to Workers Builds with production branch `main` — verify a successful production (or dry-run) build appears in Cloudflare
- [ ] 2.2 Enable non-production branch / preview builds and confirm Workers Builds is set to post GitHub PR comments — verify settings match design.md Decisions
- [ ] 2.3 Open a throwaway PR (or use an existing branch), wait for a successful preview build, and verify the PR has a Cloudflare comment with a reachable HTTPS preview URL that loads the SPA
- [x] 2.4 On the preview URL, refresh a non-root client path (or equivalent SPA check) and verify the app shell loads instead of a bare missing-asset error; after merge to `main`, verify the production HTTPS URL serves the same correctly

## 3. Integration sanity

- [ ] 3.1 Confirm existing GitHub Actions workflows (`checks`, `integration`, `lighthouse`, `stryker-diff`) are unchanged in purpose and still green on the hosting config PR
- [x] 3.2 Smoke-check that local `pnpm verify:fast` still passes after dependency/config additions

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [ ] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive

## Workflow follow-up

- Archive the change only after `openspec-implementation-reviewer` returns pass.
- Sync/archive `preview-hosting` into main specs as part of archive.
