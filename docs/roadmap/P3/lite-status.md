# lite-status

Tag: lite
Milestone: P3
Title: Bug: /next-roadmap-item lite-status

## Scope

- [x] `pnpm roadmap done` for `code-scout-first` (#620) and `lint-no-wait-for-timeout` (#622): both `[lite]` items merged without `Status: done` in their item files, so `roadmap next` still offered them.
- [x] Cause named in the PR body (file:line): the lite runs skipped `pnpm agent finalize`, and no gate noticed.
- [x] Gate: C1 `item-done` (`scripts/check-item-done.mjs`, `quality/gates.json` `integrity`) fails a `feat|fix/<slug>` branch whose own item file lacks `Status: done`; it runs in finalize (after `roadmap done`), pre-push C1 and CI `Integrity checks`. Branches without an item (main, dependabot, unknown slug) skip.
- [x] One rule in `docs/agent-loop.md` 10–11 (lite too); the lite track line, the must-read flow line and `.claude/skills/roadmap/SKILL.md` point to it.
- **Done when:** both item files carry `Status: done`; `pnpm roadmap check` green and `roadmap next` offers neither; the gate fails on the #620 / #622 item files and passes on full-track done items (unit test + evidence in the PR body); `pnpm check:fast` green.
- **Browser check:** N/A (process tooling only).
