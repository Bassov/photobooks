# preview-qa-run

Tag: prep
Milestone: M2.1
Title: the agent runs the manual scenarios on the Cloudflare preview (issue #72 G)

## Scope

- [ ] Manual test scenarios from `tasks.md` are written as Playwright tests tagged `@preview` under `e2e/preview/`, one per scenario. A Playwright `preview` project takes `baseURL` from `PREVIEW_URL`
- [ ] `.github/workflows/preview-qa.yml` (check `preview-qa`): wait (≤ 15 min) for the Cloudflare preview of the PR head SHA, take the URL from the Cloudflare PR comment or check, run the `@preview` project against it, upload the report and screenshots, and write a "Preview run" section (URL, observed result per scenario) into the CI report comment
- [ ] A scenario that cannot be automated yet (a native folder dialog before `fsa-permission-e2e`) is listed as "not automated: <reason>", and the CI report shows the count. Owner testing on the preview stays optional
- [ ] `.cursor/rules/git-finish.mdc`: a UI PR is ready only with a green `preview-qa` on its head SHA, and the PR body links that run
- **Done when:** a UI PR shows a green `preview-qa` with per-scenario results and screenshots taken from the real preview URL, and a broken scenario turns it red.
