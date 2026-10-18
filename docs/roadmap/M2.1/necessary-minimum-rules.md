# necessary-minimum-rules

Tag: prep
Milestone: M2.1
Title: Necessary-minimum rules for artifacts and code, tests exempt (issue #78)
Status: done

## Scope

- [x] Quality bar / artifact rules: proposal and design contain only what the item needs (N/A in one line, `design.md` only for real decisions); code reuse ladder (exists → codebase → platform → installed dependency → minimum new code); bug fixes grep all callers and fix the root once; moved code keeps validation, data-loss handling, security, a11y and perf budgets
- [x] Tests are explicitly exempt: coverage / mutation / PBT / e2e geometry bars unchanged
- [x] The three OpenSpec reviewer briefs flag scope beyond the item, unrequested options or abstractions, re-implemented helpers and padded sections, and never flag tests as excessive
- **Done when:** the rules are in `openspec/config.yaml` and the three reviewer briefs, with the test exemption stated, and gates are unchanged or stricter.
- **Size:** ~200 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #78

## Done note

Rules in openspec/config.yaml + three reviewer briefs; tests exempt; gates unchanged. Owner follow-up: added open M2.2 item spread-thumb-render-scope (not implemented). Assumption: Tag: perf from draft filed as feature (CLI tags).
