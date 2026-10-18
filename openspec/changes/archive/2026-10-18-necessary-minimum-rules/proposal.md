# Proposal

## Why

Reviews bounce on mechanical padding: over-scoped proposals/designs, re-implemented helpers, and unrequested abstractions. Issue #78 asks for necessary-minimum rules so agents ship only what the item needs. Now, while M2.1 still hardens the agent pipeline.

## What Changes

- Add necessary-minimum rules to `openspec/config.yaml` (quality bar + proposal/design rules): artifacts contain only what the item needs; N/A in one line; `design.md` only for real decisions; code reuse ladder (exists → codebase → platform → installed dependency → minimum new code); bug fixes grep all callers and fix the root once; moved code keeps validation, data-loss handling, security, a11y, and perf budgets.
- State explicitly that **tests are exempt** from necessary-minimum (coverage / mutation / PBT / e2e geometry bars stay unchanged or stricter).
- Update the three OpenSpec reviewer briefs to flag scope beyond the item, unrequested options/abstractions, re-implemented helpers, and padded sections — and to never flag tests as excessive.

## Scope

**In**

- `openspec/config.yaml` rules / quality bar text for necessary-minimum + test exemption
- `.cursor/agents/openspec-{proposal,design,implementation}-reviewer.md` checks for the same

**Out**

- Gate thresholds, CI workflows, Playwright config, e2e specs, `e2e/flaky.json`, skill `write-tests`
- Product/runtime code and delta specs
- Implementing any follow-up product item added in this PR's roadmap edit

## Capabilities

### New Capabilities

(none — docs/rules only; `skip_specs: true`)

### Modified Capabilities

(none)

## Success criteria

- Necessary-minimum rules and the test exemption appear in `openspec/config.yaml` and all three reviewer briefs
- Reviewer briefs flag over-scope / padding / re-implemented helpers and do not treat thorough tests as excess
- `pnpm check` stays green; quality gates are unchanged or stricter

## Risks

- Over-aggressive “minimum” wording could be misread as cutting tests — mitigated by an explicit exemption in config and all three briefs

## Impact

Agent planning and review briefs only. No app behavior, no new dependencies, no gate config edits.
