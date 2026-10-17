# perf-size-budgets

Tag: prep
Milestone: M2.1
Title: enforced bundle and Lighthouse budgets (#50 item 10, issue #48)

## Scope

- [ ] Native LHCI `resource-summary:*` assertions generated from the `quality/gates.json` budget values replace `settings.budgetsPath` / `performance-budget`. A JS / CSS gzip size check on `dist/` in `checks`. The ratchet compares the values, so changing the mechanism keeps every limit
- [ ] README, `docs/future-architecture.md` and `openspec/config.yaml` point to `quality/gates.json`. The third-party count is coordinated with the M2.5 self-hosted fonts
- **Done when:** a fixture with a temporarily low budget makes the check fail (shown once in the PR), and the limits live only in `quality/gates.json`.
