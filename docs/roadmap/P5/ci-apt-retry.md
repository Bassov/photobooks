# ci-apt-retry

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item ci-apt-retry
Status: done

CI jobs sometimes fail before any test runs because `apt-get` inside `playwright install --with-deps` /
`playwright install-deps` hits a transient mirror error (follow-up 3 of #654 ci-flakes). Retry transient apt /
network failures so a mirror blip no longer turns a PR red.

## Scope

- [ ] Every "Install Playwright browsers" / "Install Playwright system deps" step in
      `.github/workflows/integration.yml` (3 jobs) and `.github/workflows/perf.yml` runs through one shared wrapper
      that sets apt `Acquire::Retries` and retries the command ≤3 times with a short backoff; no change to what is
      installed, cache keys, job conditions or check names.
- [ ] A real failure still fails the step after the last attempt (unit test: always-failing command → exit ≠0,
      flaky command ok on try 2 → exit 0).
- **Browser check:** n/a (CI-only change).
