# reusable-ci-actions

Tag: prep
Milestone: M2.1
Title: Reusable CI Actions from @albasov/ts-agent-rig

## Scope

- [x] Pin `@albasov/ts-agent-rig` to `#v0.2.0` (Owner-approved scope change in PR body)
- [x] Rewire `checks` / `lighthouse` / `stryker-diff`: `setup-node-pnpm`, `report-section-pack`, reusable `ci-report-comment.yml`
- [x] Thin `pr-policy.yml` caller → reusable `pr-policy.yml@v0.2.0`
- [x] `setup-node-pnpm` only in `stryker-full`, `uikit`, and install jobs in `integration`
- [x] Keep burn-in / flaky / e2e pack logic host-owned (non-goal)
- **Done when:** host CI YAML uses the rig Actions; `pnpm check` green; PR comment sections still update
- **Size:** ~300 lines net (mostly deletions)
- **Source:** reusable CI actions plan (Bassov/ts-agent-rig v0.2.0)
