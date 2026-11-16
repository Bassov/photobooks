# roadmap-status-sweep

Tag: lite
Milestone: P4
Title: Bug: /next-roadmap-item roadmap-status-sweep
Status: done

## Scope

- [ ] `pnpm roadmap done main-red-print-test`: item file `Status: done`, scope boxes ticked as shipped by #630 (merged 5ea5e71, before the C1 `item-done` gate of lite-status #629).
- [ ] Sweep: every item file under `docs/roadmap/` whose PR is merged but lacks `Status: done` gets it the same way; `avif-encoder` stays open (deferred by the Owner, Q-15). The PR body names each changed item and its merged PR.
- **Done when:** on the branch, `pnpm roadmap next` prints no item whose PR is merged (only `avif-encoder` or nothing); `pnpm roadmap check` and C1 `item-done` are green.
- **Browser check:** none (docs only; no source, test or spec edits).
