# roadmap-audit

Tag: feature
Milestone: P1
Title: Bug: /next-roadmap-item roadmap-audit

## Scope

- [x] Every open (`[ ]`) index item gets one decision with evidence (sha / PR / file:line): keep, done, superseded or obsolete; `[x]` items still in the index are flagged for retirement (milestone `archive` only when the whole milestone and its review cut are done)
- [x] Closed items change only through `pnpm roadmap` (`done` / `sync` / `add`); obsolete or superseded item files say why in one line; kept items that shipped in part get a one-line delta note
- [x] The item that turns the Photo inspector Frame style / Arrange switch (`FRAME_STYLE_AND_ARRANGE_VISIBLE`, #389) back on exists in the index
- [x] Index counts line matches the result
- **Done when:** the PR body has a `slug | decision | evidence` row for every open item and ends with a Russian Owner summary (≤15 lines: closed by reason, kept, needs Owner); `pnpm roadmap check` passes with no `sync` warnings
- **Browser check:** N/A (docs only)
- **UI kit:** none (no matching component)
