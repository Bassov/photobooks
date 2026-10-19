# Design

## Context

Journal under `docs/lessons/` (index + 01–29 + dated) is mandated read/append. #78 table + item’s two gate pointers define the 24 dispositions. Other sessions own `stryker-diff-gate`, `exclusions-registry`, gate scripts, and `uikit-import*`.

## Goals / Non-Goals

**Goals:**

- Delete the journal; mandates become repeat → check (else area SHALL / code comment).
- PR body lists all 24 lines with disposition; extras 25–29 + dated dissolved the same way.
- Point #76/#82 gate lines at named owners without implementing those items.
- Add owner-requested `rules-dedup` after this slug (no implementation).

**Non-Goals:**

- Implementing `stryker-diff-gate` / `exclusions-registry` / gate-script work.
- `package.json` dependency changes; editing parallel-session files.
- Growing new prose rules (that is `rules-dedup`).

## Decisions

1. **Disposition first, tests only when missing** — Prefer “deleted duplicate” or “enforced by named existing check”. Add SHALL deltas only where no named home exists. New unit tests only for gaps that have neither check nor feasible “spec-only” cover within budget (`input.files` copy if no test; snapshot stability via existing store tests or a short public-API assert).
2. **Gate lines are pointers** — Quality bar already states non-weaken + budgeted Stryker disable; add one-line owner pointers to `gate-ratchet` / `gate-weakening-guard` / `stryker-disable-budget` and to `stryker-diff-gate` / `exclusions-registry` without waiting on those PRs.
3. **`rg -i lessons` cleanup** — Reword live agent/docs/roadmap narrative and scripts so the word does not appear outside archives. Allowlist only: `openspec/changes/lessons-dissolve/**` (until archive) and the factual roadmap item/index slug line for this dissolve. Item file drops process mandates pointing at the journal.
4. **Reviewer tag** — `[lesson]` removed; `[repeat]` must name the check or spec to add.

## Risks / Trade-offs

- Spec-only gotchas rely on future touches reading area specs — accepted by #78 when a check is infeasible now.
- Parallel PRs may still say “lessons” until they merge — out of scope; we clean this head.

## Touch-set

| Path                                                                                                                   | Reason                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `docs/lessons.md`, `docs/lessons/**`                                                                                   | delete journal                                                 |
| `openspec/config.yaml`                                                                                                 | drop journal mandates; repeat→check; doc budget; gate pointers |
| `openspec/specs/agent-context/spec.md` (+ delta)                                                                       | replace lessons requirements                                   |
| `openspec/specs/{preview-hosting,editor-shell,derived-cache,asset-source,spread-view,frame-budget}/spec.md` (+ deltas) | gotcha SHALLs                                                  |
| `AGENTS.md`, `docs/future-architecture.md`                                                                             | drop journal links                                             |
| `.cursor/agents/openspec-implementation-reviewer.md`                                                                   | `[lesson]` → `[repeat]`                                        |
| `docs/roadmap/M2.1/{lessons-dissolve,agent-rules,INTRO}.md`, `docs/roadmap.md` narrative as needed                     | retarget / reword; no hand-edit of index ticks                 |
| `scripts/agent.mjs`, `scripts/agent.test.mjs`                                                                          | drop lessons conflict path wording                             |
| `src/editor/EditorShell.test.tsx` (and/or tiny store snapshot test)                                                    | only if disposition needs a named check                        |
| `pnpm roadmap add rules-dedup`                                                                                         | owner-requested follow-up item file                            |

No quality-gate config edits.
