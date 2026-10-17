# perf-size-budgets

Tag: prep
Milestone: M2.1
Title: enforced bundle and Lighthouse budgets (#50 item 10, issue #48)

## Scope

- [ ] Native LHCI `resource-summary:*` assertions generated from the `quality/gates.json` budget values replace `settings.budgetsPath` / `performance-budget`. A JS / CSS gzip size check on `dist/` in `checks`. The ratchet compares the values, so changing the mechanism keeps every limit
- [ ] Issue #48: record the Google Fonts decision (allowed; why; privacy trade-off; revisit trigger: self-hosted fonts in M2.5) in `docs/future-architecture.md`; the third-party count allows exactly the font hosts
- [ ] README, `docs/future-architecture.md`, `openspec/config.yaml`, the `vite.config.ts` COEP comment and the `preview-hosting` spec point to `quality/gates.json` and match the decision
- **Done when:** a fixture with a temporarily low budget makes the check fail (shown once in the PR), the limits live only in `quality/gates.json`, and the Google Fonts decision is documented with its revisit trigger.
- **Size:** ~400 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #50 item 10, #48
