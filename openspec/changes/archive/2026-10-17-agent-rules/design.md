# Design

## Context

See proposal.md. Mandates already live in `openspec/config.yaml`; growth/split text exists but does not forbid gate weakening, does not require reviewer disposition, and `/next-roadmap-item` still stops on security-tagged items. This change is docs/rules only.

## Goals / Non-Goals

**Goals:**

- Make non-weaken, growth, reviewer disposition, and unattended security-continue loadable from config + agent docs
- Encode narrowed gate-edit severities in the implementation reviewer; require gate edits in design touch-set
- Record a dry-run of oversized overflow via `pnpm roadmap add --after` on a scratch copy (no live roadmap mutation)

**Non-Goals:**

- Mechanical CI ratchet / gate-value files
- Shipping `adversarial-reviewer` (name it in mandates only)
- App/runtime code
- Fixing e2e flakes by loosening assertions

## Decisions

1. **Quality bar + lessons + one AGENTS line** — Normative non-weaken rule in `openspec/config.yaml` quality bar (loaded on every artifact). Weakening is forbidden for any reason (including stabilizing a test) and explicitly includes looser assertions/tolerances, retries/`skip`/`fixme`/`test.fail`, and deleted tests/helpers. No `Stryker disable` until `stryker-diff-gate` defines a budget. Extend the lessons line; AGENTS gets one nav sentence, not a checklist.

2. **Growth wording** — Strengthen `rules.proposal` / `operations.apply` and `docs/roadmap/RULES.md` Change size to name deferred findings and `pnpm roadmap add --after`. Line-count target/max stay in RULES.md; config points there. No AGENTS checklist.

3. **Unattended continue** — In `.cursor/commands/next-roadmap-item.md`: drop security-tagged from the stop list; security-tagged or security-surface items continue and run Security Review before archive. Until `gate-ratchet`/`gate-ratchet-ci` merge, a gate-config edit MUST be strictly stricter and listed in the touch-set with a reason; otherwise stop (do not claim the ratchet already exists). Until `dependency-policy` merges, a new or changed dependency needs `pnpm audit:ci` evidence and a Security Review pass before archive. `git-finish.mdc`: red checks → code/tests only; never weaken gates or assertions.

4. **Reviewer disposition** — Apply/archive guidance: blocking findings fixed or `pnpm roadmap add --after`; PR body records verdicts. Name Security Review and future `adversarial-reviewer`. Security Review is mandatory for `(Security Review: …)` tags and for security-surface touches.

5. **Gate-edit severities** — Implementation reviewer: **high** when a gate-file edit is missing from the touch-set, has no stated reason, or makes any gate less strict; a listed strictly stricter edit is not a finding; any other config edit outside the touch-set → high; same-diff coverage/mutation exclusion of a modified production file → critical. `rules.design` / design-reviewer: touch-set MUST list every gate-file edit with reason.

6. **Dry-run evidence** — `## Oversized-item dry-run` in `tasks.md`: run `pnpm roadmap add <new-slug> --after agent-rules` on a scratch copy with a genuinely new hypothetical slug (e.g. `agent-rules-gate-values`), capture real `add` + `next` output, discard the scratch tree. Do not mutate the live roadmap for fiction.

## Touch-set

| File                                                       | Why                                                                                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openspec/config.yaml`                                     | quality bar non-weaken; proposal/apply growth + deferred findings; design gate-edit touch-set rule; apply/archive reviewer disposition; Security Review trigger |
| `docs/lessons.md`                                          | extend non-weaken lesson                                                                                                                                        |
| `AGENTS.md`                                                | one nav line                                                                                                                                                    |
| `docs/roadmap/RULES.md`                                    | Change size growth / deferred findings; line-count SoT                                                                                                          |
| `.cursor/commands/next-roadmap-item.md`                    | remove security stop; interim stricter+touch-set-or-stop for gate-config; interim dep audit+Security Review until dependency-policy                             |
| `.cursor/rules/git-finish.mdc`                             | red CI → code/tests only; never weaken gates/assertions                                                                                                         |
| `.cursor/agents/openspec-implementation-reviewer.md`       | narrowed gate-edit severities                                                                                                                                   |
| `.cursor/agents/openspec-design-reviewer.md`               | touch-set must list gate-file edits with reasons                                                                                                                |
| `openspec/changes/agent-rules/specs/agent-context/spec.md` | delta                                                                                                                                                           |
| `openspec/specs/agent-context/spec.md`                     | sync at archive                                                                                                                                                 |
| `docs/roadmap/M2.1/agent-rules.md`                         | tick scope during apply                                                                                                                                         |
| `openspec/changes/agent-rules/tasks.md`                    | oversized dry-run section                                                                                                                                       |

No gate-file threshold edits in this change (docs only). No `src/` code. No e2e assertion changes.

## Composition / boundaries

- Per-change mandates stay only in `openspec/config.yaml`.
- AGENTS remains navigation (≤150 lines).
- Roadmap index changes only via `pnpm roadmap` (dry-run must not hand-edit).

## Risks / Trade-offs

- [Soft enforcement] Docs without ratchet → Mitigate: interim stop unless stricter+touch-set; later M2.1 gate items; implementation reviewer severities catch same-diff exclusions and weaker gates.
- [Agents skip Security Review] → Mitigate: archive checklist + tagged-item / security-surface trigger.

## Migration

Edit listed files in one PR; archive syncs `agent-context`. No runtime migration.
