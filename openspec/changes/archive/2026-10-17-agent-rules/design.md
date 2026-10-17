# Design

## Context

See proposal.md. Mandates already live in `openspec/config.yaml`; growth/split text exists but does not forbid gate weakening, does not require reviewer disposition, and `/next-roadmap-item` still stops on security-tagged items. This change is docs/rules only.

## Goals / Non-Goals

**Goals:**

- Make non-weaken, growth, reviewer disposition, and unattended security-continue loadable from config + agent docs
- Encode gate-edit severities in the implementation reviewer; require gate edits in design touch-set
- Record a dry-run of oversized overflow via `pnpm roadmap add --after` (no real add unless apply truly overflows)

**Non-Goals:**

- Mechanical CI ratchet / gate-value files
- Shipping `adversarial-reviewer` (name it in mandates only)
- App/runtime code

## Decisions

1. **Quality bar + lessons + one AGENTS line** — Normative non-weaken rule in `openspec/config.yaml` quality bar (loaded on every artifact). Extend the lessons line; AGENTS gets one nav sentence, not a checklist.

2. **Growth wording** — Strengthen `rules.proposal` / `operations.apply` and `docs/roadmap/RULES.md` Change size to name deferred findings and `pnpm roadmap add --after`. No AGENTS checklist.

3. **Unattended continue** — In `.cursor/commands/next-roadmap-item.md`: drop security-tagged from the stop list; security-tagged items continue and run Security Review before archive; gate-config edits need no stop (ratchet stricter-only). Keep Conditional Security Review archive mandate. `git-finish.mdc`: red checks → code/tests only; never weaken gate config.

4. **Reviewer disposition** — Apply/archive guidance: blocking findings fixed or `pnpm roadmap add --after`; PR body records verdicts. Name Security Review and future `adversarial-reviewer`.

5. **Gate-edit severities** — Implementation reviewer: gate-file edit or config outside design touch-set → high; same-diff coverage/mutation exclusion of a modified production file → critical. `rules.design`: touch-set MUST list every gate-file edit with reason. Gate files: coverage config, `stryker.config.json` / `stryker.mutate.md`, ESLint/tsconfig strictness, CI gate workflows / threshold JSON, Codecov/LHCI budgets when used as gates.

6. **Dry-run evidence** — `## Oversized-item dry-run` in `tasks.md`: hypothetical split (e.g. bundling `gate-ratchet`), exact `pnpm roadmap add … --after agent-rules`, and “not executed — this change stayed in budget.” Do not mutate the live roadmap for fiction.

## Touch-set

| File                                                       | Why                                                                                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `openspec/config.yaml`                                     | quality bar non-weaken; proposal/apply growth + deferred findings; design gate-edit touch-set rule; apply/archive reviewer disposition |
| `docs/lessons.md`                                          | extend non-weaken lesson                                                                                                               |
| `AGENTS.md`                                                | one nav line                                                                                                                           |
| `docs/roadmap/RULES.md`                                    | Change size growth / deferred findings                                                                                                 |
| `.cursor/commands/next-roadmap-item.md`                    | remove security stop; gate-config continue (stricter-only)                                                                             |
| `.cursor/rules/git-finish.mdc`                             | red CI → code/tests only                                                                                                               |
| `.cursor/agents/openspec-implementation-reviewer.md`       | gate-edit severities                                                                                                                   |
| `openspec/changes/agent-rules/specs/agent-context/spec.md` | delta                                                                                                                                  |
| `openspec/specs/agent-context/spec.md`                     | sync at archive                                                                                                                        |
| `docs/roadmap/M2.1/agent-rules.md`                         | tick scope during apply                                                                                                                |
| `openspec/changes/agent-rules/tasks.md`                    | oversized dry-run section                                                                                                              |

No gate-file threshold edits in this change (docs only). No `src/` code.

## Composition / boundaries

- Per-change mandates stay only in `openspec/config.yaml`.
- AGENTS remains navigation (≤150 lines).
- Roadmap index changes only via `pnpm roadmap` (dry-run must not hand-edit).

## Risks / Trade-offs

- [Soft enforcement] Docs without ratchet → Mitigate: later M2.1 gate items; implementation reviewer severities catch same-diff exclusions.
- [Agents skip Security Review] → Mitigate: existing archive checklist item + agent-context requirement unchanged in spirit.

## Migration

Edit listed files in one PR; archive syncs `agent-context`. No runtime migration.
