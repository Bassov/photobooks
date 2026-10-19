# rules-dedup

Tag: prep
Milestone: M2.1
Title: Deduplicate agent rules and cap their size
Status: done

## Scope

- [x] One owner per rule across AGENTS.md, .cursor/rules/*.mdc, .cursor/commands, .cursor/agents, openspec/config.yaml, openspec reviewer briefs, quality/review-checklist.md: delete verified duplicates, keep the rule at its single owner and link from elsewhere only if needed
- [x] A line/char budget per rule file in quality/gates.json, checked in pr-policy and ratcheted (may only go down, gate-ratchet covers it)
- [x] A repeated finding becomes a check, never a new prose rule, unless the check is infeasible
- **Done when:** the PR body lists every removed duplicate with its kept owner, the budget check is red on a scratch over-budget file and green on main, and total rule-file size is lower than before.
- **Size:** ~800 changed lines
- **Source:** owner decision 2026-10-19

## Done note

quality/review-checklist.md remains deferred to agent-self-check; scoped rule owners + agentRules.budgets shipped
