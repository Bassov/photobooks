# roadmap-check-item-body

Tag: prep
Milestone: M2.1
Title: roadmap check validates item bodies and follow-up placement (PR #82 S6)

## Scope

- [ ] `pnpm roadmap check`: no `TODO` placeholders; a `[prep]` item has `**Done when:**`; a `[feature]` item has `**Browser check:**`; a `[contingency]` item names its gate owner (`Gate: <slug>`, slug exists in the index)
- [ ] `check --base <ref>` (used in `pr-policy` and `pnpm agent finish`) applies the body rules to items added or changed versus the base and to every item of the current milestone, so legacy items elsewhere do not block (they are backfilled in `roadmap-done-when-backfill`)
- [ ] `roadmap add` requires `--done-when` (prep) / `--browser-check` (feature) / `--gate` (contingency) or `--body-file`, and no longer writes TODO bodies. Follow-ups added in a branch must sit directly after the branch's own item or after the previous follow-up (no circular placement before the item that produces the evidence)
- [ ] Tests at the `scripts/roadmap.mjs` bar
- **Done when:** PR #82's original follow-up (a `[contingency]` without a gate owner or Done when) fails `roadmap check --base`, `roadmap add --tag prep` without a Done when fails, and `pnpm roadmap check` on `main` stays green.
- **Size:** ~500 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #82 S6, PR #80 S1, PR #81 S1
