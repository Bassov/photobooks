# Tasks

## 1. Non-weaken mandates

- [x] 1.1 Add non-weaken rule to `openspec/config.yaml` quality bar; extend `docs/lessons.md` tsconfig/ESLint line to coverage/mutation/thresholds/inline disables; add one AGENTS.md nav line — verify by grepping those files for the rule and `wc -l AGENTS.md` ≤150
- [x] 1.2 Update `.cursor/rules/git-finish.mdc` so red checks are fixed with code/tests only, never gate config — verify the rule text is present

## 2. Growth and reviewer disposition

- [x] 2.1 Strengthen `rules.proposal` / `operations.apply` and `docs/roadmap/RULES.md` Change size for over-budget + deferred findings via `pnpm roadmap add --after` — verify `openspec instructions proposal --change agent-rules` (or any change) surfaces the growth wording and RULES.md names deferred findings
- [x] 2.2 Add apply/archive guidance for blocking critical/high findings (proposal/design/implementation/Security Review/adversarial-reviewer): fix or schedule next checkbox; PR records verdicts — verify text in `openspec/config.yaml`

## 3. Unattended flow and review severities

- [x] 3.1 Update `.cursor/commands/next-roadmap-item.md`: remove security-tagged stop; continue with Security Review; until ratchet lands, gate-config edits must be stricter + touch-set or stop; until dependency-policy lands, new deps need audit:ci + Security Review — verify continue/stop wording
- [x] 3.2 Update `.cursor/agents/openspec-implementation-reviewer.md` with narrowed gate-edit severities (high only for missing/unreasoned/weaker; listed stricter not a finding; same-diff exclusion → critical); add `rules.design` touch-set gate-file reason mandate — verify both files

## 4. Dry-run and roadmap item

- [x] 4.1 Fill `## Oversized-item dry-run` below with a real scratch-copy `pnpm roadmap add` + `pnpm roadmap next` output for a new hypothetical slug — verify section is complete and the repo roadmap is unchanged (`pnpm roadmap check` passes; no fictional add committed)
- [x] 4.2 Tick matching scope checkboxes in `docs/roadmap/M2.1/agent-rules.md` as each item lands — verify scope boxes match shipped files

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — green (1 pre-existing flaky filmstrip LoAF/filechooser, passed on retry); e2e assertions left at main strict containment (no weakening)
- [x] pnpm stryker:diff — No mutable src files changed vs origin/main; skipping Stryker
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (docs/rules only)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A (non-UI prep)
- [x] Docs/rules sync: AGENTS.md (76 lines), git-finish, next-roadmap-item, implementation-reviewer, design-reviewer, lessons, RULES.md, config.yaml, roadmap item scope ticked; README/future-architecture unchanged (no product behavior)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — pass (medium/low only; Decision 3 gate-config continue fixed before apply); re-run after review fixes on final head
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — re-run on final worktree after PR #76 review fixes (pass once committed; prior HEAD findings were uncommitted). High: e2e weakening → reverted to main + scheduled `add-spread-reveal-flake`. Medium: archive proposal/design drift → fixed
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI prep — recorded under Manual test scenarios; oversized-item dry-run evidence below
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — N/A (docs/rules only; not security-tagged)
- [x] PR #76 review: scheduled `pnpm roadmap add add-spread-reveal-flake --after agent-rules` (strict containment flake; Done when 50/50) — verify index line after `agent-rules`

## Oversized-item dry-run

Hypothetical: during `agent-rules`, also shipping a gate-values file + threshold raises would exceed the size/subsystem budget. Overflow becomes a new checkbox immediately after `agent-rules`.

Executed on a scratch copy (not committed):

```bash
cp -a . /tmp/dry-agent-rules && cd /tmp/dry-agent-rules
pnpm -s roadmap add agent-rules-gate-values --after agent-rules --tag prep \
  --title "Split gate-values file work out of an oversized agent-rules change"
pnpm -s roadmap next
```

Real output:

```text
added agent-rules-gate-values to M2.1 (after agent-rules); file docs/roadmap/M2.1/agent-rules-gate-values.md
slug: agent-rules-gate-values
tag: prep
status: open
milestone: M2.1 — Quality gates & dev process
goal: **Review cut:** CI mechanically refuses changes like PR #68, #70 and #71, and no label or approval overrides it. Gate configs can only get stricter. Production logic cannot be excluded from coverage or mutation. These fail: patch coverage under 85%, a mutation score under 85, any NoCoverage mutant, a changed-but-excluded file, invalid ARIA, and a PR over 1500 changed lines. The stateful session and editor files are back in mutation scope behind unit-level fakes. Agents write failing tests first, tick tasks only with evidence, and resolve their reviewer sub-agents' blocking findings. They run the manual scenarios on the Cloudflare preview themselves and record the results in the PR.
goal: Notes: [INTRO.md](docs/roadmap/M2.1/INTRO.md)
title: Split gate-values file work out of an oversized agent-rules change
file: docs/roadmap/M2.1/agent-rules-gate-values.md
---
## Scope

- [ ] TODO: scope
- **Done when:** TODO
```

Index line inserted after `agent-rules` (scratch only):

```text
- [ ] [prep] [agent-rules-gate-values](roadmap/M2.1/agent-rules-gate-values.md) — Split gate-values file work out of an oversized agent-rules change
```

Scratch discarded; repo `docs/roadmap.md` unchanged. `pnpm roadmap check` passes on the real branch.

## Manual test scenarios

N/A — non-UI `[prep]` (docs/rules only). Spec scenarios validated via file grep and `openspec validate agent-rules --strict`. Oversized-item dry-run evidence recorded above.
