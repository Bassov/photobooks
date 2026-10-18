# Design

## Context

See proposal.md — Why. Rules live only in `openspec/config.yaml` and the three `.cursor/agents/openspec-*-reviewer.md` briefs. No product code, no gate configs, no delta specs (`skip_specs: true`).

## Goals / Non-Goals

**Goals**

- Encode necessary-minimum for artifacts and production code in one place agents already load
- Mirror the same checks (plus test exemption) in proposal/design/implementation reviewer briefs
- Keep coverage / mutation / PBT / e2e geometry bars untouched

**Non-Goals**

- Automating the rules in CI lint (human/agent review only this PR)
- Changing test authorship skill or flaky/e2e machinery (other session)
- Implementing product follow-ups added via roadmap in this PR

## Decisions

1. **Where the normative text lives** — Add a short "Necessary minimum" bullet block under Quality bar in `openspec/config.yaml`, plus matching bullets under `rules.proposal` / `rules.design` (and a one-line apply reminder if needed). Prefer quality-bar text for code/reuse/bug-fix/move invariants; proposal/design rules for artifact slimness (N/A one-liner, design only for real decisions). Alternative considered: only reviewer briefs — rejected because apply agents must see the bar without opening briefs.

2. **Test exemption wording** — Explicit sentence in quality bar and all three briefs: necessary-minimum does **not** apply to tests; never flag thorough tests as excessive; coverage/mutation/PBT/e2e geometry bars stay unchanged or stricter. Alternative: exemption only in implementation brief — rejected; proposal/design reviewers must not cut test plans either.

3. **Reviewer brief deltas** — Add one Checks item each:
   - Proposal: flag padded sections, unrequested options/abstractions, scope beyond the item, and plans that re-implement helpers instead of the reuse ladder
   - Design: same + fail design that invents layers when an existing module suffices
   - Implementation: same on the diff; never treat added/expanded tests as excess; do not ask to shrink coverage below existing bars

4. **No gate-config touch** — Thresholds, workflows, Playwright, exclusions stay out of the touch-set. This PR only edits docs/rules text.

## Touch-set

| Path                                                 | Reason                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `openspec/config.yaml`                               | Normative necessary-minimum + test exemption                                      |
| `.cursor/agents/openspec-proposal-reviewer.md`       | Flag over-scope / padding / re-implemented helpers; test exemption                |
| `.cursor/agents/openspec-design-reviewer.md`         | Flag over-scope / padding / re-implemented helpers; test exemption                |
| `.cursor/agents/openspec-implementation-reviewer.md` | Flag over-scope / padding / re-implemented helpers; never flag tests as excessive |

Out of touch-set (do not edit): CI workflows, Playwright config, e2e specs, `e2e/flaky.json`, skill `write-tests`, `src/**`, gate JSON.

## Risks / Trade-offs

- [Ambiguous “minimum” vs thorough tests] → Explicit exemption in every touched file
- [Agents ignore review briefs] → Normative copy in `openspec/config.yaml` (loaded on every artifact)

## Migration Plan

Text-only; no rollout/rollback beyond revert of the four files.

## Open Questions

None.
